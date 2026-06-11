document.addEventListener('DOMContentLoaded', async () => {
  const pageTypeEl = document.getElementById('page-type');
  const postCountEl = document.getElementById('post-count');
  const btnScan = document.getElementById('btn-scan');
  const btnDownload = document.getElementById('btn-download');
  const errorBox = document.getElementById('error-box');

  let activeTab = null;
  let detectedPlatform = null;
  let scrapedData = null;
  let isScanning = false;

  // 1. Detect if we are on Instagram or X
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      pageTypeEl.textContent = 'None';
      return;
    }
    activeTab = tabs[0];
    const url = activeTab.url || '';

    if (url.includes('instagram.com')) {
      detectedPlatform = 'instagram';
      pageTypeEl.textContent = 'Instagram';
      btnScan.disabled = false;
    } else if (url.includes('x.com') || url.includes('twitter.com')) {
      detectedPlatform = 'x';
      pageTypeEl.textContent = 'X / Twitter';
      btnScan.disabled = false;
    } else {
      pageTypeEl.textContent = 'Unsupported Site';
      showError('Please navigate to Instagram Saved page or X Bookmarks page to scan.');
    }
  } catch (err) {
    console.error(err);
    showError('Error initializing extension popup.');
  }

  // 2. Listen for scroll progress messages from content.js
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "scan_progress") {
      postCountEl.textContent = `${message.count} detected`;
      btnScan.textContent = `Stop & Export (${message.count})`;
    } else if (message.action === "scan_complete") {
      isScanning = false;
      const rawItems = message.data || [];
      
      if (rawItems.length === 0) {
        showError('No bookmarks detected on this page.');
        resetScanButton();
        return;
      }

      // Start processing collected items (Base64 conversion)
      btnScan.disabled = true;
      btnScan.classList.remove('btn-danger');
      btnScan.style.background = '#ccc';
      
      scrapedData = [];
      let successCount = 0;

      for (let i = 0; i < rawItems.length; i++) {
        const item = rawItems[i];
        btnScan.textContent = `Converting images (${i + 1}/${rawItems.length})`;

        let base64Image = '';
        if (item.imageUrl) {
          try {
            base64Image = await fetchImageAsBase64(item.imageUrl);
            successCount++;
          } catch (fetchErr) {
            console.warn(`Failed to convert image for ${item.url}:`, fetchErr);
            base64Image = item.imageUrl; // Fallback
          }
        }

        scrapedData.push({
          id: item.id,
          platform: detectedPlatform,
          url: item.url,
          authorName: item.authorName,
          authorUsername: item.authorUsername,
          content: item.content,
          timestamp: item.timestamp,
          tags: item.tags,
          notes: '',
          thumbnail: base64Image
        });
      }

      btnScan.style.display = 'none';
      btnDownload.style.display = 'block';
      postCountEl.textContent = `${scrapedData.length} posts ready`;
    }
  });

  // 3. Scan button click handler (Toggles between start scan & stop scan)
  btnScan.addEventListener('click', () => {
    if (isScanning) {
      // Trigger stop scan inside content script
      chrome.tabs.sendMessage(activeTab.id, { action: "stop_scan" });
      btnScan.textContent = 'Stopping scroll...';
      btnScan.disabled = true;
    } else {
      // Trigger start scan inside content script
      chrome.tabs.sendMessage(activeTab.id, { action: "start_scan" }, (response) => {
        if (chrome.runtime.lastError) {
          showError('Please refresh the page before scanning.');
          return;
        }
        if (response && response.status === "started") {
          isScanning = true;
          errorBox.style.display = 'none';
          btnScan.textContent = 'Stop & Export (0)';
          btnScan.style.background = '#d90429'; // Red warning button for stop
          postCountEl.textContent = '0 detected';
        }
      });
    }
  });

  // 4. Download button click handler
  btnDownload.addEventListener('click', () => {
    if (!scrapedData || scrapedData.length === 0) return;

    const timestampStr = new Date().toISOString().split('T')[0];
    const fileName = `${detectedPlatform}_bookmarks_${timestampStr}.json`;
    const jsonString = JSON.stringify(scrapedData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: fileName,
      saveAs: true
    }, () => {
      URL.revokeObjectURL(url);
    });
  });

  // Helper to fetch image and encode in base64
  async function fetchImageAsBase64(imageUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(imageUrl, { 
        signal: controller.signal,
        credentials: 'omit',
        mode: 'cors'
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP status ${response.status}`);
      
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }

  function resetScanButton() {
    isScanning = false;
    btnScan.disabled = false;
    btnScan.textContent = 'Scan Page Bookmarks';
    btnScan.style.background = 'var(--accent-color)';
  }
});
