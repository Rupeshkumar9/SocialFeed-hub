// Auto-Scrolling Bookmarks Content Scraper
(() => {
  let isScanning = false;
  let scrollInterval = null;
  const collectedMap = new Map(); // Key: URL, Value: Bookmark object

  // Listen for messages from the popup script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_scan") {
      if (isScanning) {
        sendResponse({ status: "already_scanning" });
        return;
      }
      isScanning = true;
      collectedMap.clear();
      sendResponse({ status: "started" });
      startAutoScrollScan();
    } else if (request.action === "stop_scan") {
      stopAutoScrollScan(true); // Stop and return current data
      sendResponse({ status: "stopped" });
    }
  });

  console.log("🌸 SocialFeed content scraper initialized.");

  function startAutoScrollScan() {
    let lastScrollHeight = 0;
    let noChangeCount = 0;
    const maxNoChangeLimit = 6; // Stop after ~3 seconds of no content change at bottom
    
    // Reset scroll to top to scan everything from the beginning
    window.scrollTo(0, 0);

    scrollInterval = setInterval(() => {
      // 1. Scroll down incrementally
      window.scrollBy(0, 600);

      // 2. Perform DOM scraping of visible elements
      const platform = window.location.href.includes("instagram.com") ? "instagram" : "x";
      const newItems = platform === "instagram" ? scrapeInstagram() : scrapeTwitter();

      // Deduplicate and store
      newItems.forEach(item => {
        if (!collectedMap.has(item.url)) {
          collectedMap.set(item.url, item);
        }
      });

      // 3. Send progress update to popup
      chrome.runtime.sendMessage({
        action: "scan_progress",
        count: collectedMap.size
      });

      // 4. Check if we reached the bottom
      const currentScrollHeight = document.documentElement.scrollHeight;
      const isAtBottom = (window.innerHeight + window.scrollY) >= (currentScrollHeight - 50);

      if (isAtBottom) {
        if (currentScrollHeight === lastScrollHeight) {
          noChangeCount++;
        } else {
          noChangeCount = 0; // Height changed, things are loading
        }
      } else {
        noChangeCount = 0;
      }

      lastScrollHeight = currentScrollHeight;

      // If scroll height doesn't change for several intervals at the bottom, we are done
      if (noChangeCount >= maxNoChangeLimit) {
        stopAutoScrollScan(false);
      }
    }, 500); // Scan and scroll every 500ms
  }

  function stopAutoScrollScan(wasCancelled = false) {
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
    isScanning = false;

    // Send final payload to popup instantly
    chrome.runtime.sendMessage({
      action: "scan_complete",
      data: Array.from(collectedMap.values()),
      cancelled: wasCancelled
    });
  }

  // ==========================================
  // Instagram Scraper Logic
  // ==========================================
  function scrapeInstagram() {
    const items = [];
    const postElements = document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]');
    
    postElements.forEach((el, index) => {
      try {
        const path = el.getAttribute('href');
        if (!path) return;
        
        const postUrl = "https://www.instagram.com" + path.split('?')[0];
        const match = path.match(/\/(?:p|reel)\/([a-zA-Z0-9_\-]+)/i);
        const code = match ? match[1] : `scraped_${Date.now()}_${index}`;
        
        const imgEl = el.querySelector('img');
        const imageUrl = imgEl ? imgEl.getAttribute('src') : null;
        const altText = imgEl ? imgEl.getAttribute('alt') || '' : '';
        
        const container = el.closest('article, div[role="button"], div');
        let authorUsername = 'instagram_user';
        let authorName = 'Instagram Creator';
        let content = altText || 'Saved Instagram Post';
        
        if (altText) {
          const matchAuthor = altText.match(/^(?:Photo|Video|Reel|Media)(?:\s+shared)?\s+by\s+([^\s\.\,]+)/i) || 
                              altText.match(/^([a-zA-Z0-9_\-\.]+)'s\s+(?:photo|video|reel|post)/i) ||
                              altText.match(/by\s+([a-zA-Z0-9_\-\.]+)/i);
          if (matchAuthor && matchAuthor[1]) {
            authorUsername = matchAuthor[1].trim();
            authorName = matchAuthor[1].trim();
          }
        }

        // DOM Fallback: Check parent container for user profile link
        if (authorUsername === 'instagram_user' && container) {
          const profileLinks = container.querySelectorAll('a[href^="/"]');
          for (const pLink of profileLinks) {
            const href = pLink.getAttribute('href') || '';
            const parts = href.split('?')[0].split('/').filter(Boolean);
            if (parts.length === 1) {
              const u = parts[0].trim();
              const systemPages = ['p', 'reel', 'reels', 'explore', 'stories', 'your_activity', 'direct', 'accounts', 'developer'];
              if (u && !systemPages.includes(u.toLowerCase())) {
                authorUsername = u;
                authorName = u;
                break;
              }
            }
          }
        }

        // Extract post upload date from DOM time tag or altText date string (or "" if not found)
        let postUploadedAt = "";
        const timeEl = el.querySelector('time') || (container ? container.querySelector('time') : null);
        if (timeEl && timeEl.getAttribute('datetime')) {
          const dt = timeEl.getAttribute('datetime');
          const parsedDate = new Date(dt);
          if (!isNaN(parsedDate.getTime())) {
            postUploadedAt = parsedDate.toISOString();
          }
        } else if (altText) {
          const matchDate = altText.match(/\bon\s+([A-Za-z]+\s+\d{1,2}(?:,\s+\d{4})?)/i);
          if (matchDate) {
            const parsedDate = new Date(matchDate[1]);
            if (!isNaN(parsedDate.getTime())) {
              postUploadedAt = parsedDate.toISOString();
            }
          }
        }

        const extensionScrapedAt = new Date().toISOString();

        const hashtagRegex = /#(\w+)/g;
        const hashtags = [];
        let tagMatch;
        while ((tagMatch = hashtagRegex.exec(content)) !== null) {
          const t = tagMatch[1].toLowerCase();
          if (!hashtags.includes(t)) hashtags.push(t);
        }
        
        items.push({
          id: `ig_${code}`,
          url: postUrl,
          authorName: authorName,
          authorUsername: authorUsername,
          content: content,
          postUploadedAt: postUploadedAt,
          extensionScrapedAt: extensionScrapedAt,
          hashtags: hashtags,
          imageUrl: imageUrl
        });
      } catch (err) {
        console.error("Error Instagram element:", err);
      }
    });

    return items;
  }

  // ==========================================
  // X (Twitter) Scraper Logic
  // ==========================================
  function scrapeTwitter() {
    const items = [];
    const articles = document.querySelectorAll('article[role="article"]');
    
    articles.forEach((el, index) => {
      try {
        const links = el.querySelectorAll('a[href*="/status/"]');
        let tweetUrl = '';
        let tweetId = '';
        
        for (let link of links) {
          const href = link.getAttribute('href');
          const statusMatch = href.match(/\/(\w+)\/status\/(\d+)/i);
          if (statusMatch) {
            tweetUrl = "https://x.com" + href.split('?')[0];
            tweetId = statusMatch[2];
            break;
          }
        }
        
        if (!tweetUrl || !tweetId) return;

        const userNameDiv = el.querySelector('[data-testid="User-Name"]');
        let authorName = 'X User';
        let authorUsername = 'twitter_user';
        
        if (userNameDiv) {
          const nameSpan = userNameDiv.querySelector('span');
          if (nameSpan) authorName = nameSpan.textContent.trim();
          
          const textContent = userNameDiv.textContent || '';
          const handleMatch = textContent.match(/@(\w+)/);
          if (handleMatch) {
            authorUsername = handleMatch[1];
          }
        }

        const textDiv = el.querySelector('[data-testid="tweetText"]');
        const content = textDiv ? textDiv.textContent.trim() : 'Bookmarked X post';

        const timeEl = el.querySelector('time');
        let postUploadedAt = "";
        if (timeEl && timeEl.getAttribute('datetime')) {
          const dt = timeEl.getAttribute('datetime');
          const parsedDate = new Date(dt);
          if (!isNaN(parsedDate.getTime())) {
            postUploadedAt = parsedDate.toISOString();
          }
        }
        const extensionScrapedAt = new Date().toISOString();

        const photoImg = el.querySelector('[data-testid="tweetPhoto"] img, [data-testid="card.layoutLarge.detail"] img');
        let imageUrl = photoImg ? photoImg.getAttribute('src') : null;
        
        if (!imageUrl) {
          const videoPoster = el.querySelector('[data-testid="videoPlayer"] video');
          if (videoPoster) {
            imageUrl = videoPoster.getAttribute('poster') || null;
          }
        }

        const hashtagRegex = /#(\w+)/g;
        const hashtags = [];
        let tagMatch;
        while ((tagMatch = hashtagRegex.exec(content)) !== null) {
          const t = tagMatch[1].toLowerCase();
          if (!hashtags.includes(t)) hashtags.push(t);
        }

        items.push({
          id: `x_${tweetId}`,
          url: tweetUrl,
          authorName: authorName,
          authorUsername: authorUsername,
          content: content,
          postUploadedAt: postUploadedAt,
          extensionScrapedAt: extensionScrapedAt,
          hashtags: hashtags,
          imageUrl: imageUrl
        });
      } catch (err) {
        console.error("Error X element:", err);
      }
    });

    return items;
  }
})();
