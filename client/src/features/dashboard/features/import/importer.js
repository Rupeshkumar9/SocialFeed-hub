/**
 * Bookmarks Importer Module
 * Handles client-side parsing of extension exports and platform archives.
 */

export const BookmarksImporter = {
  /**
   * Parse uploaded file content based on file type and name
   * @param {string} fileName - Name of the file
   * @param {string} fileContent - Raw content of the file
   * @returns {Array} List of standardized bookmark objects
   */
  parse: function(fileName, fileContent) {
    const trimmedContent = fileContent.trim();
    const lowerName = fileName.toLowerCase();
    
    // Explicitly reject markdown files
    if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
      return [];
    }
    
    // 1. Check if it is the official Instagram HTML saved posts export
    if (trimmedContent.includes('class="_a6_q"') && trimmedContent.includes('instagram.com')) {
      return this.parseInstagramArchiveHTML(trimmedContent);
    }
    
    // 2. Check if it's the official X (Twitter) bookmarks.js archive file
    if (fileName.endsWith('.js') && trimmedContent.includes('window.YTD.bookmarks.part0')) {
      return this.parseTwitterArchiveJS(trimmedContent);
    }
    
    // 3. Try parsing as JSON
    try {
      const jsonData = JSON.parse(trimmedContent);
      return this.parseJSONData(jsonData);
    } catch (e) {
      // Not standard JSON, could be HTML or raw list of links
    }

    // 4. Fallback: Parse as generic text and extract URLs via Regex
    return this.parseRawTextUrls(trimmedContent);
  },

  /**
   * Parse Instagram saved_posts.html official export
   */
  parseInstagramArchiveHTML: function(htmlContent) {
    const imported = [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const tables = doc.querySelectorAll('table');
      
      tables.forEach((table, index) => {
        // Find the post URL
        const anchor = table.querySelector('a[href*="instagram.com"]');
        if (!anchor) return;
        
        const url = anchor.href.trim();
        const shortcode = this.extractInstagramCode(url) || `ig_html_${index}_${Date.now()}`;
        
        // Extract Caption
        let caption = 'Saved Instagram Post (Click to load interactive embed details)';
        const cells = Array.from(table.querySelectorAll('td'));
        const captionHeader = cells.find(td => td.textContent.trim() === 'Caption');
        if (captionHeader && captionHeader.nextElementSibling) {
          caption = captionHeader.nextElementSibling.textContent.trim();
        }
        
        // Extract Owner (Author) Info
        let authorName = 'Instagram Creator';
        let authorUsername = 'instagram_user';
        
        const nameHeader = cells.find(td => td.textContent.trim() === 'Name');
        if (nameHeader && nameHeader.nextElementSibling) {
          authorName = nameHeader.nextElementSibling.textContent.trim();
        }
        
        const usernameHeader = cells.find(td => td.textContent.trim() === 'Username');
        if (usernameHeader && usernameHeader.nextElementSibling) {
          authorUsername = usernameHeader.nextElementSibling.textContent.trim();
        }
        
        // Extract Timestamp
        const postContainer = table.closest('.noborder') || table.parentElement;
        let timestamp = new Date().toISOString();
        if (postContainer) {
          const dateEl = postContainer.querySelector('._a6-o');
          if (dateEl) {
            const dateText = dateEl.textContent.trim();
            if (dateText) {
              const parsedDate = new Date(dateText);
              if (!isNaN(parsedDate.getTime())) {
                timestamp = parsedDate.toISOString();
              }
            }
          }
        }
        
        // Parse hashtags from caption
        const hashtagRegex = /#(\w+)/g;
        const hashtags = [];
        let match;
        while ((match = hashtagRegex.exec(caption)) !== null) {
          const tag = match[1].toLowerCase();
          if (!hashtags.includes(tag)) {
            hashtags.push(tag);
          }
        }
        
        imported.push({
          id: `ig_${shortcode}`,
          platform: 'instagram',
          url: url,
          authorName: authorName,
          authorUsername: authorUsername,
          content: caption,
          timestamp: timestamp,
          hashtags: hashtags,
          notes: ''
        });
      });
    } catch (e) {
      console.error("Failed to parse Instagram HTML Saved Archive:", e);
    }
    return imported;
  },

  /**
   * Parse X/Twitter official bookmarks.js file
   */
  parseTwitterArchiveJS: function(content) {
    try {
      // Strip 'window.YTD.bookmarks.part0 = ' prefix
      const jsonStartIdx = content.indexOf('[');
      if (jsonStartIdx === -1) return [];
      
      const jsonText = content.substring(jsonStartIdx);
      // Parse the JSON array
      const rawBookmarks = JSON.parse(jsonText);
      
      return rawBookmarks.map((item, idx) => {
        const bookmarkData = item.bookmark;
        const tweetId = bookmarkData.tweetId;
        const createdAt = bookmarkData.createdAt;
        
        // Reconstruct date
        let timestamp = new Date().toISOString();
        if (createdAt) {
          const parsedDate = new Date(createdAt);
          if (!isNaN(parsedDate.getTime())) {
            timestamp = parsedDate.toISOString();
          }
        }

        return {
          id: `x_${tweetId}`,
          platform: 'x',
          url: `https://twitter.com/i/web/status/${tweetId}`,
          authorName: 'X Archive Post',
          authorUsername: 'twitter_user',
          content: 'Bookmarked X post (click to load interactive embed details)',
          timestamp: timestamp,
          hashtags: [],
          notes: ''
        };
      });
    } catch (error) {
      console.error("Failed to parse X archive JS:", error);
      return [];
    }
  },

  /**
   * Parse structured JSON files (Instagram Saved Posts or generic JSON formats)
   */
  parseJSONData: function(data) {
    const imported = [];

    // Case 0: Complete, versioned backup produced by SocialFeed Hub.
    if (data?.format === 'socialfeed-bookmarks-backup' && Array.isArray(data.bookmarks)) {
      return data.bookmarks
        .map((item, index) => this.parseSocialFeedBackupItem(item, index))
        .filter(Boolean);
    }
    
    // Case A: Instagram Saved Posts export (saved_posts.json)
    // Structure: {"saved_saved_media": [{"title": "", "string_map_data": {"Saved Time": {"timestamp": 170...}}, "uri": "https://..."}]}
    if (data.saved_saved_media && Array.isArray(data.saved_saved_media)) {
      data.saved_saved_media.forEach((item, index) => {
        if (item.uri) {
          let timestamp = new Date().toISOString();
          if (item.string_map_data && item.string_map_data["Saved Time"]) {
            const unixTime = item.string_map_data["Saved Time"].timestamp;
            if (unixTime) {
              // Instagram sometimes exports Unix timestamps in seconds
              timestamp = new Date(unixTime * 1000).toISOString();
            }
          }
          
          const idHash = this.extractInstagramCode(item.uri) || `ig_${index}_${Date.now()}`;
          
          imported.push({
            id: `ig_${idHash}`,
            platform: 'instagram',
            url: item.uri,
            authorName: 'Instagram Media',
            authorUsername: 'instagram_user',
            content: item.title || 'Saved Instagram post (click to view interactive embed comments)',
            timestamp: timestamp,
            hashtags: [],
            notes: ''
          });
        }
      });
      return imported;
    }

    // Case B: General array format (third-party export or custom export)
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        if (item.url) {
          const declaredPlatform = this.normalizePlatform(item.platform);
          const platform = declaredPlatform || this.detectPlatform(item.url);
          if (platform) {
            imported.push({
              id: item.id || `${platform}_${Date.now()}_${index}`,
              platform: platform,
              platformItemId: item.platformItemId || this.extractPlatformItemId(item.url, platform),
              url: item.url,
              authorName: item.authorName || this.defaultAuthorName(platform),
              authorUsername: item.authorUsername || this.defaultAuthorUsername(platform),
              content: item.content || item.title || `Bookmarked ${platform.toUpperCase()} Link`,
              postUploadedAt: item.postUploadedAt || '',
              extensionScrapedAt: item.extensionScrapedAt || item.timestamp || new Date().toISOString(),
              timestamp: item.extensionScrapedAt || item.timestamp || new Date().toISOString(),
              hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
              notes: item.notes || '',
              thumbnail: item.thumbnail || item.imageUrl || '',
              source: item.source || 'social',
              folder: item.folder || '',
              authorAvatar: item.authorAvatar || '',
              mediaUrls: Array.isArray(item.mediaUrls) ? item.mediaUrls : [],
              videoUrl: item.videoUrl || '',
              externalUrls: Array.isArray(item.externalUrls) ? item.externalUrls : []
            });
          }
        }
      });
      return imported;
    }

    // Case C: Object containing generic list key
    for (const key in data) {
      if (Array.isArray(data[key])) {
        // Try recursive parsing on the array
        const result = this.parseJSONData(data[key]);
        if (result.length > 0) return result;
      }
    }

    return [];
  },

  parseSocialFeedBackupItem: function(item, index) {
    if (!item || typeof item !== 'object' || !item.url) return null;
    const platform = this.normalizePlatform(item.platform) || this.detectPlatform(item.url);
    if (!platform) return null;
    return {
      id: item.id || `${platform}_${Date.now()}_${index}`,
      platform,
      platformName: item.platformName || '',
      platformItemId: item.platformItemId || this.extractPlatformItemId(item.url, platform),
      canonicalUrl: item.canonicalUrl || '',
      identityKey: item.identityKey || '',
      source: item.source || (platform === 'browser' ? 'browser' : 'social'),
      url: item.url,
      authorName: item.authorName || this.defaultAuthorName(platform),
      authorUsername: item.authorUsername || this.defaultAuthorUsername(platform),
      authorAvatar: item.authorAvatar || '',
      content: item.content || `Bookmarked ${platform.toUpperCase()} Link`,
      postUploadedAt: item.postUploadedAt || '',
      firstSavedAt: item.firstSavedAt || item.createdAt || item.extensionScrapedAt || '',
      lastScannedAt: item.lastScannedAt || '',
      extensionScrapedAt: item.extensionScrapedAt || item.firstSavedAt || item.timestamp || new Date().toISOString(),
      sourceSavedAt: item.sourceSavedAt || item.firstSavedAt || '',
      createdAt: item.createdAt || item.firstSavedAt || '',
      timestamp: item.timestamp || item.firstSavedAt || item.extensionScrapedAt || new Date().toISOString(),
      importSource: item.importSource || 'backup',
      hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
      notes: item.notes || '',
      thumbnail: item.thumbnail || item.imageUrl || '',
      favicon: item.favicon || '',
      folder: item.folder || '',
      visibility: item.visibility === 'public' ? 'public' : 'private',
      featured: item.featured === true,
      publicOrder: Number.isFinite(Number(item.publicOrder)) ? Number(item.publicOrder) : null,
      publicTitle: item.publicTitle || '',
      publicDescription: item.publicDescription || '',
      visibilityUpdatedAt: item.visibilityUpdatedAt || null,
      mediaUrls: Array.isArray(item.mediaUrls) ? item.mediaUrls : [],
      videoUrl: item.videoUrl || '',
      externalUrls: Array.isArray(item.externalUrls) ? item.externalUrls : []
    };
  },

  /**
   * Parse Raw Text / HTML files using regex to search for links
   */
  parseRawTextUrls: function(text) {
    const imported = [];
    // Regex for X/Twitter, Instagram, and Threads posts
    const twitterRegex = /https?:\/\/(?:mobile\.)?(?:twitter|x)\.com\/\w+\/status\/(\d+)/gi;
    const instagramRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reels|reel)\/([a-zA-Z0-9_-]+)/gi;
    const threadsRegex = /https?:\/\/(?:www\.)?threads\.(?:com|net)\/@([^\s/?#]+)\/post\/([a-zA-Z0-9_-]+)/gi;
    
    let match;
    let index = 0;

    // Extract Twitter status URLs
    while ((match = twitterRegex.exec(text)) !== null) {
      const url = match[0];
      const tweetId = match[1];
      imported.push({
        id: `x_${tweetId}`,
        platform: 'x',
        url: url,
        authorName: 'X Link',
        authorUsername: 'twitter_user',
        content: 'Extracted X link (click to load live embed)',
        timestamp: new Date().toISOString(),
        hashtags: [],
        notes: ''
      });
    }

    // Reset regex state
    instagramRegex.lastIndex = 0;

    // Extract Instagram post/reel URLs
    while ((match = instagramRegex.exec(text)) !== null) {
      const url = match[0];
      const mediaCode = match[1];
      imported.push({
        id: `ig_${mediaCode}`,
        platform: 'instagram',
        url: url,
        authorName: 'Instagram Link',
        authorUsername: 'instagram_user',
        content: 'Extracted Instagram link (click to load live embed)',
        timestamp: new Date().toISOString(),
        hashtags: [],
        notes: ''
      });
    }

    while ((match = threadsRegex.exec(text)) !== null) {
      imported.push({
        id: `threads_${match[2]}`,
        platform: 'threads',
        platformItemId: match[2],
        url: match[0],
        authorName: match[1],
        authorUsername: match[1],
        content: 'Extracted Threads post',
        timestamp: new Date().toISOString(),
        hashtags: [],
        notes: ''
      });
    }

    return imported;
  },

  /**
   * Helper: Detect Platform from URL
   */
  detectPlatform: function(url) {
    const lowerUrl = String(url || '').toLowerCase();
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'x';
    if (lowerUrl.includes('instagram.com')) return 'instagram';
    if (lowerUrl.includes('threads.net') || lowerUrl.includes('threads.com')) return 'threads';
    if (lowerUrl.includes('reddit.com') || lowerUrl.includes('redd.it')) return 'reddit';
    if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch')) return 'facebook';
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
    return null;
  },

  normalizePlatform: function(platform) {
    const normalized = String(platform || '').trim().toLowerCase();
    const aliases = { twitter: 'x' };
    const value = aliases[normalized] || normalized;
    return ['instagram', 'x', 'threads', 'reddit', 'facebook', 'youtube', 'browser'].includes(value) ? value : null;
  },

  defaultAuthorName: function(platform) {
    if (platform === 'x') return 'X User';
    if (platform === 'instagram') return 'Instagram Creator';
    if (platform === 'threads') return 'Threads Creator';
    return 'Social Creator';
  },

  defaultAuthorUsername: function(platform) {
    if (platform === 'x') return 'twitter_user';
    if (platform === 'instagram') return 'instagram_user';
    if (platform === 'threads') return 'threads_user';
    return 'user';
  },

  extractPlatformItemId: function(url, platform) {
    if (platform === 'threads') return url.match(/\/(?:@[^/]+\/)?post\/([a-zA-Z0-9_-]+)/i)?.[1] || '';
    if (platform === 'x') return url.match(/\/status\/(\d+)/i)?.[1] || '';
    if (platform === 'instagram') return this.extractInstagramCode(url) || '';
    return '';
  },

  /**
   * Helper: Extract Instagram shortcode from URL
   */
  extractInstagramCode: function(url) {
    const match = url.match(/\/p\/([a-zA-Z0-9_-]+)/i) || url.match(/\/reel\/([a-zA-Z0-9_-]+)/i);
    return match ? match[1] : null;
  },

  /**
   * Merge imported bookmarks into existing list, avoiding duplicates
   * @param {Array} existing - Current database list
   * @param {Array} newItems - Newly parsed bookmarks
   * @returns {object} { merged: Array, addedCount: number }
   */
  merge: function(existing, newItems) {
    const mergedList = [...existing];
    let addedCount = 0;
    let updatedCount = 0;

    // Map existing URLs to check duplicates efficiently
    const existingUrls = new Set(existing.map(item => this.normalizeUrl(item.url)));

    newItems.forEach(item => {
      const normUrl = this.normalizeUrl(item.url);
      if (!existingUrls.has(normUrl)) {
        mergedList.unshift(item); // Add new items at the top of the feed
        existingUrls.add(normUrl);
        addedCount++;
      } else {
        // A duplicate import is intentionally a no-op. The bookmark already in
        // the feed owns its notes, tags, folder, thumbnail, and original date.
        updatedCount++;
      }
    });

    return {
      merged: mergedList,
      addedCount: addedCount,
      updatedCount: updatedCount
    };
  },

  /**
   * Helper: Normalize URL to prevent matching issues due to trailing slashes or queries
   */
  normalizeUrl: function(url) {
    try {
      const urlObj = new URL(url);
      // Strip query parameters
      urlObj.search = '';
      // Ensure hostname is generic
      let host = urlObj.hostname.replace('mobile.', '').replace('www.', '');
      if (host === 'x.com') host = 'twitter.com';
      if (host === 'threads.net') host = 'threads.com';
      if (host === 'redd.it') host = 'reddit.com';
      
      let path = urlObj.pathname;
      if (path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      
      return `${host}${path}`;
    } catch (e) {
      return url.toLowerCase().trim();
    }
  }
};
