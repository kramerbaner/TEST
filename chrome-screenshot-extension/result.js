const mainEl = document.getElementById('main');
const metaEl = document.getElementById('meta');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btn-download');
const btnCopy = document.getElementById('btn-copy');

let currentDataUrl = null;
let currentFilename = 'zrzut-strony.png';

const MODE_LABELS = {
  visible: 'Widoczny obszar',
  'full-page': 'Cała strona',
  selection: 'Zaznaczony fragment',
};

function showStatus(text) {
  statusEl.textContent = text;
  statusEl.classList.add('show');
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => statusEl.classList.remove('show'), 2200);
}

function sanitizeForFilename(str) {
  return (str || 'strona').replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]+/gi, '_').slice(0, 60);
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function render(data) {
  if (!data || !data.dataUrl) {
    mainEl.innerHTML = '<div class="empty">Brak zapisanego zrzutu. Wykonaj zrzut z menu rozszerzenia.</div>';
    return;
  }
  currentDataUrl = data.dataUrl;

  let host = 'strona';
  try {
    host = new URL(data.meta?.url || '').hostname || 'strona';
  } catch (e) {
    /* ignore invalid url */
  }
  currentFilename = `zrzut_${sanitizeForFilename(host)}_${formatTimestamp(data.ts)}.png`;

  const modeLabel = MODE_LABELS[data.meta?.mode] || 'Zrzut';
  metaEl.textContent = `${modeLabel} • ${data.meta?.url || ''} • ${new Date(data.ts).toLocaleString('pl-PL')}`;

  mainEl.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  const img = document.createElement('img');
  img.src = data.dataUrl;
  img.alt = 'Zrzut strony';
  wrap.appendChild(img);
  mainEl.appendChild(wrap);
}

function loadLastCapture() {
  chrome.runtime.sendMessage({ type: 'get-last-capture' }, (res) => {
    if (chrome.runtime.lastError) {
      mainEl.innerHTML = `<div class="empty">Błąd wczytywania: ${chrome.runtime.lastError.message}</div>`;
      return;
    }
    render(res && res.data);
  });
}

btnDownload.addEventListener('click', () => {
  if (!currentDataUrl) return;
  chrome.downloads.download(
    { url: currentDataUrl, filename: currentFilename, saveAs: false },
    () => {
      if (chrome.runtime.lastError) {
        showStatus(`Błąd pobierania: ${chrome.runtime.lastError.message}`);
      } else {
        showStatus('Zapisano PNG.');
      }
    }
  );
});

btnCopy.addEventListener('click', async () => {
  if (!currentDataUrl) return;
  try {
    const blob = await (await fetch(currentDataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    showStatus('Skopiowano do schowka.');
  } catch (err) {
    showStatus(`Nie udało się skopiować: ${err.message || err}`);
  }
});

loadLastCapture();
