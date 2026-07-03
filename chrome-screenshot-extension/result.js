const mainEl = document.getElementById('main');
const metaEl = document.getElementById('meta');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btn-download');
const btnCopy = document.getElementById('btn-copy');
const btnCrop = document.getElementById('btn-crop');
const btnCropApply = document.getElementById('btn-crop-apply');
const btnCropCancel = document.getElementById('btn-crop-cancel');
const btnRestore = document.getElementById('btn-restore');

let originalDataUrl = null; // the untouched capture, kept so a crop can be undone
let currentDataUrl = null; // what's displayed / downloaded / copied
let currentFilename = 'zrzut-strony.png';
let imgEl = null;
let cropSession = null; // active drag-crop state, or null when not cropping

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
    btnCrop.hidden = true;
    btnDownload.disabled = true;
    btnCopy.disabled = true;
    return;
  }
  originalDataUrl = data.dataUrl;
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

  renderImage(currentDataUrl);
  btnRestore.hidden = true;
}

function renderImage(dataUrl) {
  mainEl.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  const stage = document.createElement('div');
  stage.className = 'crop-stage';
  imgEl = document.createElement('img');
  imgEl.src = dataUrl;
  imgEl.alt = 'Zrzut strony';
  stage.appendChild(imgEl);
  wrap.appendChild(stage);
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

// ---------- Crop ----------
function setCropToolbarState(active) {
  btnCrop.hidden = active;
  btnCropApply.hidden = !active;
  btnCropCancel.hidden = !active;
  btnDownload.disabled = active;
  btnCopy.disabled = active;
}

function startCrop() {
  if (!imgEl || cropSession) return;
  const stage = imgEl.parentElement;

  const overlay = document.createElement('div');
  overlay.className = 'crop-overlay';
  const hint = document.createElement('div');
  hint.className = 'crop-hint';
  hint.textContent = 'Przeciągnij, aby zaznaczyć fragment do przycięcia';
  overlay.appendChild(hint);
  const box = document.createElement('div');
  box.className = 'crop-box';
  overlay.appendChild(box);
  stage.appendChild(overlay);

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let rect = null; // last confirmed rect in stage-local (displayed) px

  function localPos(e) {
    const r = overlay.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, e.clientX - r.left), r.width),
      y: Math.min(Math.max(0, e.clientY - r.top), r.height),
    };
  }

  function updateBox(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.display = 'block';
  }

  overlay.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    const p = localPos(e);
    startX = p.x;
    startY = p.y;
    hint.style.display = 'none';
    updateBox(startX, startY, startX, startY);
    e.preventDefault();
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const p = localPos(e);
    updateBox(startX, startY, p.x, p.y);
  });

  overlay.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    const p = localPos(e);
    const left = Math.min(startX, p.x);
    const top = Math.min(startY, p.y);
    const width = Math.abs(p.x - startX);
    const height = Math.abs(p.y - startY);
    if (width < 6 || height < 6) {
      box.style.display = 'none';
      rect = null;
      return;
    }
    rect = { left, top, width, height };
  });

  cropSession = { overlay, box, getRect: () => rect };
  setCropToolbarState(true);
}

function cancelCrop() {
  if (!cropSession) return;
  cropSession.overlay.remove();
  cropSession = null;
  setCropToolbarState(false);
}

function applyCrop() {
  if (!cropSession || !imgEl) return;
  const rect = cropSession.getRect();
  if (!rect) {
    showStatus('Najpierw zaznacz fragment do przycięcia.');
    return;
  }
  const scaleX = imgEl.naturalWidth / imgEl.clientWidth;
  const scaleY = imgEl.naturalHeight / imgEl.clientHeight;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(rect.width * scaleX);
  canvas.height = Math.round(rect.height * scaleY);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    imgEl,
    rect.left * scaleX,
    rect.top * scaleY,
    rect.width * scaleX,
    rect.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  currentDataUrl = canvas.toDataURL('image/png');
  cropSession.overlay.remove();
  cropSession = null;
  setCropToolbarState(false);
  renderImage(currentDataUrl);
  btnRestore.hidden = false;
  showStatus('Przycięto.');
}

function restoreOriginal() {
  currentDataUrl = originalDataUrl;
  renderImage(currentDataUrl);
  btnRestore.hidden = true;
  showStatus('Przywrócono oryginalny zrzut.');
}

btnCrop.addEventListener('click', startCrop);
btnCropCancel.addEventListener('click', cancelCrop);
btnCropApply.addEventListener('click', applyCrop);
btnRestore.addEventListener('click', restoreOriginal);

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
