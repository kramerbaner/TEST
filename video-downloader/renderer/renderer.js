const $ = (id) => document.getElementById(id);

let currentJobId = null;
let currentFolder = null;

async function init() {
  currentFolder = await window.api.defaultDownloadFolder();
  $('folder').value = currentFolder;

  const deps = await window.api.checkDependencies();
  if (!deps.ytdlp || !deps.ffmpeg) {
    const missing = [];
    if (!deps.ytdlp) missing.push(`yt-dlp (próbowano: ${deps.ytdlpPath})`);
    if (!deps.ffmpeg) missing.push(`ffmpeg (próbowano: ${deps.ffmpegPath})`);
    $('deps-detail').innerHTML = 'Brakuje:<br>' + missing.join('<br>');
    $('deps-warning').classList.remove('hidden');
    $('download').disabled = true;
  }

  $('format').addEventListener('change', () => {
    $('quality-field').style.visibility = $('format').value === 'audio' ? 'hidden' : 'visible';
  });

  $('choose-folder').addEventListener('click', async () => {
    const folder = await window.api.chooseFolder();
    if (folder) {
      currentFolder = folder;
      $('folder').value = folder;
    }
  });

  $('open-folder').addEventListener('click', () => {
    window.api.openFolder(currentFolder);
  });

  $('download').addEventListener('click', startDownload);
  $('cancel').addEventListener('click', cancelDownload);

  $('url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startDownload();
  });

  window.api.onProgress((data) => {
    if (data.id !== currentJobId) return;
    const pct = data.percent || 0;
    $('progress-fill').style.width = pct + '%';
    $('progress-percent').textContent = pct.toFixed(1) + '%';
    $('progress-text').textContent = `Pobieranie · ${data.size || ''}`;
    $('progress-speed').textContent = data.speed ? `Prędkość: ${data.speed}` : '';
    $('progress-eta').textContent = data.eta ? `Pozostało: ${data.eta}` : '';
  });

  window.api.onLog((data) => {
    if (data.id !== currentJobId) return;
    const log = $('log');
    log.textContent += data.line + '\n';
    log.scrollTop = log.scrollHeight;
  });

  window.api.onFinished((data) => {
    if (data.id !== currentJobId) return;
    $('cancel').classList.add('hidden');
    $('download').classList.remove('hidden');
    $('download').disabled = false;
    if (data.success) {
      $('progress-text').textContent = 'Gotowe!';
      $('progress-fill').style.width = '100%';
      $('progress-percent').textContent = '100%';
    } else {
      $('progress-text').textContent = data.error ? `Błąd: ${data.error}` : 'Pobieranie nieudane - sprawdź log';
    }
    currentJobId = null;
  });
}

async function startDownload() {
  const url = $('url').value.trim();
  if (!url) {
    $('url').focus();
    return;
  }

  currentJobId = 'job-' + Date.now();
  $('log').textContent = '';
  $('progress-card').classList.remove('hidden');
  $('progress-fill').style.width = '0%';
  $('progress-percent').textContent = '0%';
  $('progress-text').textContent = 'Łączenie...';
  $('progress-speed').textContent = '';
  $('progress-eta').textContent = '';
  $('download').classList.add('hidden');
  $('cancel').classList.remove('hidden');

  await window.api.startDownload({
    id: currentJobId,
    url,
    outputDir: currentFolder,
    format: $('format').value,
    quality: $('quality').value
  });
}

async function cancelDownload() {
  if (currentJobId) {
    await window.api.cancelDownload(currentJobId);
    $('progress-text').textContent = 'Anulowano';
  }
}

init();
