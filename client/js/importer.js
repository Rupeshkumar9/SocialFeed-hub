/**
 * Bookmarks Importer Module
 * Handles client-side parsing of exported archive files from X and Instagram.
 */

const BookmarksImporter = {
  /**
   * Parse uploaded file content based on file type and name
   * @param {string} fileName - Name of the file
   * @param {string} fileContent - Raw content of the file
   * @returns {Array} List of standardized bookmark objects
   */
  parse: function(fileName, fileContent) {
    const trimmedContent = fileContent.trim();
    
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
        const tags = ['imported'];
        let match;
        while ((match = hashtagRegex.exec(caption)) !== null) {
          const tag = match[1].toLowerCase();
          if (!tags.includes(tag)) {
            tags.push(tag);
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
          tags: tags,
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
          tags: ['imported', 'x-archive'],
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
            tags: ['imported', 'instagram-archive'],
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
          const platform = this.detectPlatform(item.url);
          if (platform) {
            imported.push({
              id: item.id || `${platform}_${Date.now()}_${index}`,
              platform: platform,
              url: item.url,
              authorName: item.authorName || (platform === 'x' ? 'X User' : 'Instagram Creator'),
              authorUsername: item.authorUsername || (platform === 'x' ? 'twitter_user' : 'instagram_user'),
              content: item.content || item.title || `Bookmarked ${platform.toUpperCase()} Link`,
              timestamp: item.timestamp || new Date().toISOString(),
              tags: Array.isArray(item.tags) ? item.tags : ['imported'],
              notes: item.notes || '',
              thumbnail: item.thumbnail || ''
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

  /**
   * Parse Raw Text / HTML files using regex to search for links
   */
  parseRawTextUrls: function(text) {
    const imported = [];
    // Regex for X/Twitter and Instagram posts
    const twitterRegex = /https?:\/\/(?:mobile\.)?(?:twitter|x)\.com\/\w+\/status\/(\d+)/gi;
    const instagramRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reels|reel)\/([a-zA-Z0-9_-]+)/gi;
    
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
        tags: ['extracted-link'],
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
        tags: ['extracted-link'],
        notes: ''
      });
    }

    return imported;
  },

  /**
   * Helper: Detect Platform from URL
   */
  detectPlatform: function(url) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
      return 'x';
    }
    if (lowerUrl.includes('instagram.com')) {
      return 'instagram';
    }
    return null;
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
        // Enriched existing items (e.g. if they have no thumbnail, but the imported one does)
        const idx = mergedList.findIndex(x => this.normalizeUrl(x.url) === normUrl);
        if (idx !== -1) {
          const matchItem = mergedList[idx];
          
          // Update details from extension scrape
          const isBase64 = item.thumbnail && item.thumbnail.startsWith('data:');
          const isExistingExpiredUrl = matchItem.thumbnail && (matchItem.thumbnail.startsWith('http://') || matchItem.thumbnail.startsWith('https://'));
          if (item.thumbnail && (!matchItem.thumbnail || (isBase64 && isExistingExpiredUrl))) {
            matchItem.thumbnail = item.thumbnail;
            updatedCount++;
          }
          if (item.authorName && (matchItem.authorName === 'X Link' || matchItem.authorName === 'Instagram Link' || matchItem.authorName === 'Instagram Creator')) {
            matchItem.authorName = item.authorName;
            matchItem.authorUsername = item.authorUsername;
          }
          if (item.content && (matchItem.content === 'Bookmarked X post' || matchItem.content.startsWith('Saved Instagram Post') || !matchItem.content)) {
            matchItem.content = item.content;
          }
          
          // Merge tags
          if (item.tags) {
            matchItem.tags = Array.from(new Set([...matchItem.tags, ...item.tags]));
          }
        }
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
