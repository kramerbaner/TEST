const STORAGE_KEY = 'lastCapture';
const UNCAPTURABLE_PREFIXES = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'https://chrome.google.com/webstore'];

function isCapturable(url) {
  return !!url && !UNCAPTURABLE_PREFIXES.some((p) => url.startsWith(p));
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
}

async function captureVisibleTabWithRetry(windowId, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    } catch (err) {
      const msg = String((err && err.message) || err);
      if (msg.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND') && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 550));
        continue;
      }
      throw err;
    }
  }
}

async function openResult(dataUrl, meta) {
  await chrome.storage.local.set({ [STORAGE_KEY]: { dataUrl, meta, ts: Date.now() } });
  await chrome.tabs.create({ url: chrome.runtime.getURL('result.html') });
}

async function startCapture(kind) {
  const tab = await getActiveTab();
  if (!tab) return { ok: false, error: 'Brak aktywnej karty.' };
  if (!isCapturable(tab.url)) {
    return { ok: false, error: 'Tej strony nie można zrzucić (strona wewnętrzna przeglądarki).' };
  }
  if (kind === 'visible') {
    const dataUrl = await captureVisibleTabWithRetry(tab.windowId);
    await openResult(dataUrl, { mode: 'visible', title: tab.title, url: tab.url });
    return { ok: true };
  }
  await ensureContentScript(tab.id);
  const type = kind === 'full-page' ? 'start-full-page-capture' : 'start-selection';
  chrome.tabs.sendMessage(tab.id, { type });
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'popup-capture-visible':
          sendResponse(await startCapture('visible'));
          break;
        case 'popup-capture-full-page':
          sendResponse(await startCapture('full-page'));
          break;
        case 'popup-capture-selection':
          sendResponse(await startCapture('selection'));
          break;
        case 'capture-visible-tab-for-content': {
          const tab = sender.tab;
          const dataUrl = await captureVisibleTabWithRetry(tab.windowId);
          sendResponse({ ok: true, dataUrl });
          break;
        }
        case 'full-page-captured':
          await openResult(message.dataUrl, { mode: 'full-page', title: sender.tab?.title, url: sender.tab?.url });
          sendResponse({ ok: true });
          break;
        case 'selection-captured':
          await openResult(message.dataUrl, { mode: 'selection', title: sender.tab?.title, url: sender.tab?.url });
          sendResponse({ ok: true });
          break;
        case 'get-last-capture': {
          const data = await chrome.storage.local.get(STORAGE_KEY);
          sendResponse({ ok: true, data: data[STORAGE_KEY] });
          break;
        }
        case 'check-active-tab': {
          const tab = await getActiveTab();
          sendResponse({ ok: true, capturable: isCapturable(tab?.url), url: tab?.url });
          break;
        }
        default:
          sendResponse({ ok: false, error: 'Nieznany typ wiadomości.' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    }
  })();
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-selection') await startCapture('selection');
  else if (command === 'capture-full-page') await startCapture('full-page');
});
