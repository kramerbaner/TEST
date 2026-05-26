const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function findBinary(name) {
  const candidates = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
    path.join(os.homedir(), '.local', 'bin', name)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return name;
}

const YT_DLP = findBinary('yt-dlp');
const FFMPEG = findBinary('ffmpeg');

ipcMain.handle('check-dependencies', async () => {
  const result = { ytdlp: false, ffmpeg: false, ytdlpVersion: null };
  try {
    await new Promise((resolve, reject) => {
      execFile(YT_DLP, ['--version'], (err, stdout) => {
        if (err) return reject(err);
        result.ytdlp = true;
        result.ytdlpVersion = stdout.trim();
        resolve();
      });
    });
  } catch (e) {}
  try {
    await new Promise((resolve, reject) => {
      execFile(FFMPEG, ['-version'], (err) => {
        if (err) return reject(err);
        result.ffmpeg = true;
        resolve();
      });
    });
  } catch (e) {}
  return result;
});

ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: path.join(os.homedir(), 'Downloads')
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('open-folder', async (_evt, folderPath) => {
  if (folderPath && fs.existsSync(folderPath)) {
    shell.openPath(folderPath);
    return true;
  }
  return false;
});

ipcMain.handle('default-download-folder', async () => {
  return path.join(os.homedir(), 'Downloads');
});

const activeJobs = new Map();

ipcMain.handle('start-download', async (_evt, { id, url, outputDir, format, quality }) => {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const args = [
    '--newline',
    '--no-colors',
    '--progress',
    '-o', path.join(outputDir, '%(title)s [%(id)s].%(ext)s'),
    '--ffmpeg-location', path.dirname(FFMPEG)
  ];

  if (format === 'audio') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    let formatString;
    if (quality === 'best') {
      formatString = 'bestvideo+bestaudio/best';
    } else {
      const h = parseInt(quality, 10);
      formatString = `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`;
    }
    args.push('-f', formatString, '--merge-output-format', 'mp4');
  }

  args.push(url);

  const proc = spawn(YT_DLP, args);
  activeJobs.set(id, proc);

  const send = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, { id, ...data });
    }
  };

  proc.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    text.split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      const progressMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*([\d.]+\w+)(?:\s+at\s+([\d.]+\w+\/s))?(?:\s+ETA\s+([\d:]+))?/);
      if (progressMatch) {
        send('download-progress', {
          percent: parseFloat(progressMatch[1]),
          size: progressMatch[2],
          speed: progressMatch[3] || '',
          eta: progressMatch[4] || ''
        });
      } else {
        send('download-log', { line });
      }
    });
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    text.split(/\r?\n/).forEach((line) => {
      if (line.trim()) send('download-log', { line, stderr: true });
    });
  });

  proc.on('close', (code) => {
    activeJobs.delete(id);
    send('download-finished', { code, success: code === 0 });
  });

  proc.on('error', (err) => {
    activeJobs.delete(id);
    send('download-finished', { code: -1, success: false, error: err.message });
  });

  return { started: true };
});

ipcMain.handle('cancel-download', async (_evt, { id }) => {
  const proc = activeJobs.get(id);
  if (proc) {
    proc.kill('SIGTERM');
    activeJobs.delete(id);
    return true;
  }
  return false;
});
