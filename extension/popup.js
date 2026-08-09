document.addEventListener('DOMContentLoaded', async () => {
  const pageTypeEl = document.getElementById('page-type');
  const postCountEl = document.getElementById('post-count');
  const btnScan = document.getElementById('btn-scan');
  const btnDownload = document.getElementById('btn-download');
  const btnCancelScan = document.getElementById('btn-cancel-scan');
  const btnSync = document.getElementById('btn-sync');
  const btnScanBrowser = document.getElementById('btn-scan-browser');
  const errorBox = document.getElementById('error-box');
  const successBox = document.getElementById('success-box');

  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const inputApiUrl = document.getElementById('input-api-url');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnConnectWebsite = document.getElementById('btn-connect-website');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const connectionStatus = document.getElementById('connection-status');

  const DEFAULT_API_URL = 'https://socialfeed-hub.onrender.com';
  const PENDING_SCAN_KEY = 'pendingScan';
  const PENDING_SCAN_TTL_MS = 30 * 60 * 1000;

  function normalizeApiUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '') || DEFAULT_API_URL;
  }

  let activeTab = null;
  let activePlatform = null;
  let detectedPlatform = null;
  let scrapedData = null;
  let isScanning = false;

  // 1. Storage Helpers
  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['apiUrl', 'extensionDeviceToken', 'extensionSyncToken', 'pairingState'], (res) => {
        resolve({
          apiUrl: normalizeApiUrl(res.apiUrl),
          extensionDeviceToken: res.extensionDeviceToken || '',
          // Keep reading the old value so existing installations continue to work during migration.
          extensionSyncToken: res.extensionSyncToken || '',
          pairingState: res.pairingState || null
        });
      });
    });
  }

  function saveSettings(apiUrl, extra = {}) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ apiUrl: normalizeApiUrl(apiUrl), ...extra }, () => {
        resolve();
      });
    });
  }

  function clearConnectionState() {
    return new Promise(resolve => chrome.storage.local.remove(['extensionDeviceToken', 'extensionSyncToken', 'pairingState'], resolve));
  }

  function persistPendingScan() {
    if (!Array.isArray(scrapedData) || !scrapedData.length || !detectedPlatform) return Promise.resolve(false);
    return new Promise(resolve => {
      chrome.storage.local.set({
        [PENDING_SCAN_KEY]: {
          savedAt: Date.now(),
          platform: detectedPlatform,
          items: scrapedData
        }
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Unable to persist pending scan:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  }

  function clearPendingScan() {
    return new Promise(resolve => chrome.storage.local.remove(PENDING_SCAN_KEY, resolve));
  }

  function loadPendingScan() {
    return new Promise(resolve => {
      chrome.storage.local.get(PENDING_SCAN_KEY, async result => {
        if (chrome.runtime.lastError) {
          console.warn('Unable to restore pending scan:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        const pending = result[PENDING_SCAN_KEY];
        const isFresh = pending && Number.isFinite(pending.savedAt) && Date.now() - pending.savedAt <= PENDING_SCAN_TTL_MS;
        if (!isFresh || !Array.isArray(pending.items) || !pending.items.length) {
          if (pending) await clearPendingScan();
          resolve(false);
          return;
        }
        scrapedData = pending.items;
        detectedPlatform = pending.platform || activePlatform || 'browser';
        resolve(true);
      });
    });
  }

  function showPreparedActions() {
    btnScan.style.display = 'none';
    btnScanBrowser.style.display = 'none';
    btnScan.disabled = true;
    btnScanBrowser.disabled = true;
    btnSync.style.display = 'block';
    btnDownload.style.display = 'block';
    btnCancelScan.style.display = 'block';
    const itemLabel = detectedPlatform === 'browser' ? 'bookmarks' : 'posts';
    postCountEl.textContent = `${scrapedData?.length || 0} ${itemLabel} ready`;
  }

  async function resetToHome({ clearPending = true } = {}) {
    if (clearPending) await clearPendingScan();
    scrapedData = null;
    detectedPlatform = activePlatform;
    isScanning = false;
    btnScan.style.display = 'block';
    btnScan.disabled = !activePlatform;
    btnScan.textContent = 'Scan Platform Posts';
    btnScan.style.background = 'var(--accent-color)';
    btnScanBrowser.style.display = 'block';
    btnScanBrowser.disabled = false;
    btnSync.style.display = 'none';
    btnDownload.style.display = 'none';
    btnCancelScan.style.display = 'none';
    postCountEl.textContent = '0';
    errorBox.style.display = 'none';
    successBox.style.display = 'none';
  }

  function setConnectionStatus(message, state = '', options = {}) {
    const hasCredential = Boolean(options.hasCredential);
    const pairingPending = Boolean(options.pairingPending);
    const connectionLocked = Boolean(options.connectionLocked ?? (hasCredential || pairingPending || state === 'connected'));
    connectionStatus.textContent = message;
    connectionStatus.className = `connection-status ${state}`.trim();
    btnDisconnect.hidden = !(state === 'connected' || hasCredential);
    btnConnectWebsite.hidden = state === 'connected';
    btnConnectWebsite.disabled = connectionLocked;
    btnConnectWebsite.textContent = state === 'connected'
      ? 'Connected to SocialFeed'
      : connectionLocked
        ? 'Disconnect to reconnect'
        : 'Connect using SocialFeed login';
  }

  async function connectionRequest(apiUrl, path, options = {}) {
    const response = await fetch(`${normalizeApiUrl(apiUrl)}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  async function refreshConnectionStatus() {
    const settings = await getSettings();
    const credential = settings.extensionDeviceToken || settings.extensionSyncToken;
    if (!credential) {
      setConnectionStatus(
        settings.pairingState ? 'Waiting for website confirmation…' : 'Not connected',
        '',
        { pairingPending: Boolean(settings.pairingState) }
      );
      if (settings.pairingState) await checkPairing(settings);
      return;
    }
    try {
      const headers = settings.extensionDeviceToken
        ? { Authorization: `Bearer ${settings.extensionDeviceToken}` }
        : { 'X-Extension-Token': settings.extensionSyncToken };
      await connectionRequest(settings.apiUrl, '/api/extension/pair/check', { cache: 'no-store', headers });
      setConnectionStatus('Connected to SocialFeed', 'connected', { hasCredential: true });
    } catch (error) {
      if (/connect|token|credential|unauthorized/i.test(error.message)) {
        await clearConnectionState();
        setConnectionStatus('Connection expired. Reconnect required.', 'error');
      } else {
        // Keep the existing credential available for disconnect, but block a
        // second pairing until the user explicitly disconnects this one.
        setConnectionStatus('Unable to check connection.', 'error', { hasCredential: true });
      }
    }
  }

  async function checkPairing(settings = null) {
    const current = settings || await getSettings();
    const state = current.pairingState;
    if (!state?.pairingId || !state?.secret) return false;
    try {
      const result = await connectionRequest(current.apiUrl, `/api/extension/pair/status?pairingId=${encodeURIComponent(state.pairingId)}&secret=${encodeURIComponent(state.secret)}`);
      if (result.status === 'authorized' && result.token) {
        await saveSettings(current.apiUrl, { extensionDeviceToken: result.token, pairingState: null });
        await new Promise(resolve => chrome.storage.local.remove(['extensionSyncToken'], resolve));
        setConnectionStatus('Connected to SocialFeed', 'connected', { hasCredential: true });
        showSuccess('Extension connected successfully.');
        return true;
      }
      setConnectionStatus('Waiting for website confirmation…', '', { pairingPending: true });
      return false;
    } catch (error) {
      await clearConnectionState();
      setConnectionStatus(error.message || 'Pairing request expired.', 'error');
      return false;
    }
  }

  // 2. Initialize Settings
  try {
    const settings = await getSettings();
    inputApiUrl.value = settings.apiUrl;
    await refreshConnectionStatus();
  } catch (err) {
    console.error('Error loading settings:', err);
  }

  // 3. Toggle Settings Panel
  btnSettingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('active');
  });

  // 4. Save Settings Button
  btnSaveSettings.addEventListener('click', async () => {
    const urlVal = inputApiUrl.value.trim() || DEFAULT_API_URL;
    
    await saveSettings(urlVal);
    showSuccess('Settings saved!');
    setTimeout(() => {
      successBox.style.display = 'none';
      settingsPanel.classList.remove('active');
    }, 1000);
  });

  btnConnectWebsite.addEventListener('click', async () => {
    btnConnectWebsite.disabled = true;
    showError('');
    try {
      const settings = await getSettings();
      if (settings.extensionDeviceToken || settings.extensionSyncToken) {
        // A connection already belongs to this extension installation. Do not
        // create another device just because the status check is temporarily
        // unavailable; require an explicit disconnect first.
        await refreshConnectionStatus();
        return;
      }
      if (settings.pairingState) {
        await checkPairing(settings);
        return;
      }
      const result = await connectionRequest(settings.apiUrl, '/api/extension/pair/start', { method: 'POST' });
      await saveSettings(settings.apiUrl, { pairingState: { pairingId: result.pairingId, secret: result.secret } });
      setConnectionStatus('Waiting for website confirmation…', '', { pairingPending: true });
      chrome.tabs.create({ url: result.connectUrl, active: false });
      const deadline = Date.now() + 10 * 60 * 1000;
      const poll = async () => {
        const connected = await checkPairing(await getSettings());
        if (!connected && Date.now() < deadline) setTimeout(poll, 2000);
      };
      setTimeout(poll, 1500);
    } catch (error) {
      showError(`Unable to start connection: ${error.message}`);
      setConnectionStatus('Not connected', 'error');
    } finally {
      const latest = await getSettings();
      if (!latest.extensionDeviceToken && !latest.extensionSyncToken && !latest.pairingState) {
        btnConnectWebsite.disabled = false;
      }
    }
  });

  btnDisconnect.addEventListener('click', async () => {
    const settings = await getSettings();
    btnDisconnect.disabled = true;
    try {
      const credential = settings.extensionDeviceToken || settings.extensionSyncToken;
      if (credential) {
        const headers = settings.extensionDeviceToken
          ? { Authorization: `Bearer ${settings.extensionDeviceToken}` }
          : { 'X-Extension-Token': credential };
        await connectionRequest(settings.apiUrl, '/api/extension/pair/revoke', { method: 'POST', headers });
      }
    } catch (error) {
      console.warn('Unable to revoke extension credential remotely:', error);
    } finally {
      await clearConnectionState();
      setConnectionStatus('Disconnected');
      btnDisconnect.disabled = false;
      showSuccess('This extension was disconnected.');
    }
  });

  // 5. Detect if we are on Instagram or X
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      pageTypeEl.textContent = 'None';
      return;
    }
    activeTab = tabs[0];
    const url = activeTab.url || '';

    if (url.includes('instagram.com')) {
      activePlatform = 'instagram';
      detectedPlatform = activePlatform;
      pageTypeEl.textContent = 'Instagram';
      btnScan.disabled = false;
    } else if (url.includes('x.com') || url.includes('twitter.com')) {
      activePlatform = 'x';
      detectedPlatform = activePlatform;
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

  if (await loadPendingScan()) {
    showPreparedActions();
  }

  // 6. Listen for scroll progress messages from content.js
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "scan_progress") {
      postCountEl.textContent = `${message.count} detected`;
      btnScan.textContent = `Stop & Export (${message.count})`;
    } else if (message.action === "scan_complete") {
      isScanning = false;
      const rawItems = message.data || [];
      
      if (rawItems.length === 0) {
        showError('No bookmarks detected on this page.');
        await resetToHome();
        return;
      }

      // Start processing collected items (Base64 conversion)
      btnScan.disabled = true;
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
          source: detectedPlatform === 'browser' ? 'browser' : 'social',
          folder: item.folder || '',
          url: item.url,
          authorName: item.authorName,
          authorUsername: item.authorUsername,
          content: item.content,
          postUploadedAt: item.postUploadedAt || '',
          extensionScrapedAt: item.extensionScrapedAt || new Date().toISOString(),
          hashtags: item.hashtags || [],
          notes: '',
          thumbnail: base64Image
        });
      }

      await persistPendingScan();
      showPreparedActions();
    }
  });

  // 7. Scan button click handler (Toggles between start scan & stop scan)
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
          btnScanBrowser.style.display = 'none';
          errorBox.style.display = 'none';
          successBox.style.display = 'none';
          btnScan.textContent = 'Stop & Export (0)';
          btnScan.style.background = '#d90429'; // Red warning button for stop
          postCountEl.textContent = '0 detected';
        }
      });
    }
  });

  // 8. Scan Chrome browser bookmarks
  if (btnScanBrowser) btnScanBrowser.addEventListener('click', () => {
    btnScanBrowser.disabled = true;
    chrome.bookmarks.getTree((tree) => {
      const items = [];
      const walk = (nodes, trail = []) => nodes.forEach(node => {
        const nextTrail = node.title ? trail.concat(node.title) : trail;
        if (node.url) items.push({ id: 'browser_' + node.id, platform: 'browser', source: 'browser', url: node.url, authorName: new URL(node.url).hostname.replace(/^www\./, ''), authorUsername: 'browser', content: node.title || 'Saved browser bookmark', extensionScrapedAt: new Date(node.dateAdded || Date.now()).toISOString(), hashtags: [], folder: trail.filter(Boolean).join(' / ') });
        if (node.children) walk(node.children, nextTrail);
      });
      walk(tree);
      scrapedData = items;
      detectedPlatform = 'browser';
      persistPendingScan();
      showPreparedActions();
      showSuccess('Found ' + items.length + ' Chrome bookmarks. Existing links will be skipped.');
    });
  });

  btnCancelScan.addEventListener('click', () => resetToHome());

  // 9. Download button click handler
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

  // 9. Sync button click handler (Save to database)
  btnSync.addEventListener('click', async () => {
    if (!scrapedData || scrapedData.length === 0) return;

    errorBox.style.display = 'none';
    successBox.style.display = 'none';

    const currentSettings = await getSettings();
    const credential = currentSettings.extensionDeviceToken || currentSettings.extensionSyncToken;
    if (!credential) {
      showError('Connect this extension first. Click ⚙️ and choose Connect using SocialFeed login.');
      settingsPanel.classList.add('active');
      return;
    }

    btnSync.disabled = true;
    btnSync.textContent = 'Saving to database...';
    btnDownload.disabled = true;

    try {
      const response = await fetch(`${currentSettings.apiUrl}/api/import-scraped`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentSettings.extensionDeviceToken
            ? { Authorization: `Bearer ${currentSettings.extensionDeviceToken}` }
            : { 'X-Extension-Token': credential })
        },
        body: JSON.stringify(scrapedData)
      });

      const resData = await response.json();

      if (!response.ok) {
        if (response.status === 401 && currentSettings.extensionDeviceToken) {
          await clearConnectionState();
          setConnectionStatus('Connection revoked. Reconnect required.', 'error');
        }
        throw new Error(resData.error || `HTTP error! Status: ${response.status}`);
      }

      showSuccess(`Successfully synced! Added: ${resData.added || 0}, Skipped: ${resData.skipped || 0}`);
      btnSync.textContent = 'Synced!';
      btnDownload.disabled = false;
    } catch (err) {
      console.error('Database sync failed:', err);
      showError(`Sync failed: ${err.message}`);
      btnSync.disabled = false;
      btnSync.textContent = 'Save to Social Feed';
      btnDownload.disabled = false;
    }
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
    successBox.style.display = 'none';
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }

  function showSuccess(msg) {
    errorBox.style.display = 'none';
    successBox.textContent = msg;
    successBox.style.display = 'block';
  }

});
