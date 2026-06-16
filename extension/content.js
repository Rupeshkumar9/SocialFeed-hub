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

    // Send final payload to popup
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
        
        let authorUsername = 'instagram_user';
        let authorName = 'Instagram Creator';
        let content = altText || 'Saved Instagram Post';
        
        if (altText) {
          const matchAuthor = altText.match(/^Photo by ([a-zA-Z0-9_\-\.]+)/i) || 
                              altText.match(/^([a-zA-Z0-9_\-\.]+)'s photo/i);
          if (matchAuthor) {
            authorUsername = matchAuthor[1];
            authorName = matchAuthor[1];
          }
        }

        const hashtagRegex = /#(\w+)/g;
        const tags = ['imported', 'instagram'];
        let tagMatch;
        while ((tagMatch = hashtagRegex.exec(content)) !== null) {
          const t = tagMatch[1].toLowerCase();
          if (!tags.includes(t)) tags.push(t);
        }
        
        items.push({
          id: `ig_${code}`,
          url: postUrl,
          authorName: authorName,
          authorUsername: authorUsername,
          content: content,
          timestamp: new Date().toISOString(),
          tags: tags,
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

        const timestamp = new Date().toISOString();

        const photoImg = el.querySelector('[data-testid="tweetPhoto"] img, [data-testid="card.layoutLarge.detail"] img');
        let imageUrl = photoImg ? photoImg.getAttribute('src') : null;
        
        if (!imageUrl) {
          const videoPoster = el.querySelector('[data-testid="videoPlayer"] video');
          if (videoPoster) {
            imageUrl = videoPoster.getAttribute('poster') || null;
          }
        }

        const hashtagRegex = /#(\w+)/g;
        const tags = ['imported', 'x-post'];
        let tagMatch;
        while ((tagMatch = hashtagRegex.exec(content)) !== null) {
          const t = tagMatch[1].toLowerCase();
          if (!tags.includes(t)) tags.push(t);
        }

        items.push({
          id: `x_${tweetId}`,
          url: tweetUrl,
          authorName: authorName,
          authorUsername: authorUsername,
          content: content,
          timestamp: timestamp,
          tags: tags,
          imageUrl: imageUrl
        });
      } catch (err) {
        console.error("Error X element:", err);
      }
    });

    return items;
  }
})();
