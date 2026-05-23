'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const BackendManager = require('./backend-manager');
const licenseManager = require('./license');
const MarkdownIt     = require('markdown-it');
const md             = new MarkdownIt({ html: true, linkify: true, typographer: true });

// Single-instance lock
if (!app.requestSingleInstanceLock()) { app.quit(); }

// ── globals ────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray       = null;
let backend    = null;
let isQuitting = false;

const isDev     = !app.isPackaged;
const assetsDir = path.join(__dirname, '..', 'assets');
const srcDir    = path.join(__dirname, '..', 'src');

// ── resource paths ─────────────────────────────────────────────────────────
/**
 * In production (packaged), electron-builder places extraResources under
 * process.resourcesPath.  In dev we use the local resources/ folder.
 */
function getResourcesDir() {
  return isDev
    ? path.join(__dirname, '..', 'resources')
    : process.resourcesPath;
}

function getJreBinPath() {
  // The JRE is extracted to resources/jre — find the bin folder dynamically
  // (Temurin zips include a versioned top-level dir like jdk-21.0.x-jre/)
  const jreRoot = path.join(getResourcesDir(), 'jre');
  if (!fs.existsSync(jreRoot)) return null;

  // Look one level deep for a directory containing a bin/java.exe
  const entries = fs.readdirSync(jreRoot);
  for (const entry of entries) {
    const candidate = path.join(jreRoot, entry, 'bin');
    if (fs.existsSync(path.join(candidate, 'java.exe'))) return candidate;
    if (fs.existsSync(path.join(candidate, 'java')))     return candidate;
  }

  // Flat layout fallback (resources/jre/bin/java.exe)
  const flat = path.join(jreRoot, 'bin');
  if (fs.existsSync(flat)) return flat;

  return null;
}

function getJarPath() {
  return path.join(getResourcesDir(), 'stirling-pdf.jar');
}

// ── settings ───────────────────────────────────────────────────────────────
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
let settings = {
  port: 8080,
  autoStart: true,
  autoLaunch: true,
  theme: 'dark',
  windowBounds: { width: 1200, height: 820 },
};

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath))
      settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
  } catch (_) {}
}
function saveSettings() {
  try { fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2)); } catch (_) {}
}

// ── auto-launch ────────────────────────────────────────────────────────────
async function setupAutoLaunch() {
  try {
    const AutoLaunch = require('auto-launch');
    const al = new AutoLaunch({ name: 'Quantheo', path: app.getPath('exe'), isHidden: true });
    settings.autoLaunch ? al.enable() : al.disable();
  } catch (_) {}
}

// ── tray ───────────────────────────────────────────────────────────────────
function buildTrayMenu() {
  const label = { stopped: '⚫ Stopped', starting: '🟡 Starting…', running: '🟢 Running', error: '🔴 Error' };
  return Menu.buildFromTemplate([
    { label: 'Quantheo', enabled: false },
    { type: 'separator' },
    { label: label[backend.status] || '⚫ Unknown', enabled: false },
    { type: 'separator' },
    { label: '📂 Open Dashboard',  click: showWindow },
    { label: '🌐 Open in Browser', click: () => shell.openExternal(backend.getUrl()) },
    { type: 'separator' },
    { label: '▶  Start',   enabled: ['stopped', 'error'].includes(backend.status), click: () => backend.start() },
    { label: '🔄 Restart', enabled: backend.status === 'running',                  click: () => backend.restart() },
    { label: '⏹  Stop',    enabled: ['running', 'starting'].includes(backend.status), click: () => backend.stop() },
    { type: 'separator' },
    { label: '✖ Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);
}

function createTray() {
  const iconFile = path.join(assetsDir, 'tray-icon.png');
  const img = fs.existsSync(iconFile)
    ? nativeImage.createFromPath(iconFile).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(img);
  tray.setToolTip('Quantheo');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', showWindow);
  backend.on('status', () => tray.setContextMenu(buildTrayMenu()));
}

// ── main window ────────────────────────────────────────────────────────────
function createMainWindow() {
  const { width, height } = settings.windowBounds;
  mainWindow = new BrowserWindow({
    width, height, minWidth: 900, minHeight: 620,
    frame: false, backgroundColor: '#0a0b12', show: false,
    icon: path.join(assetsDir, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      webviewTag: true, devTools: isDev,
    },
  });

  mainWindow.loadFile(path.join(srcDir, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });
  mainWindow.on('close', (e) => { if (!isQuitting) { e.preventDefault(); mainWindow.hide(); } });
  mainWindow.on('resize', () => {
    const b = mainWindow.getBounds();
    settings.windowBounds = { width: b.width, height: b.height };
    saveSettings();
  });
}

function showWindow() {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
}

// ── IPC ────────────────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.handle('backend:status',  () => ({
    status: backend.status,
    error:  backend.lastError,
    url:    backend.getUrl(),
    port:   settings.port,
  }));
  ipcMain.handle('backend:start',   () => backend.start());
  ipcMain.handle('backend:stop',    () => backend.stop());
  ipcMain.handle('backend:restart', () => backend.restart());
  ipcMain.handle('backend:url',     () => backend.getUrl());

  ipcMain.handle('app:open-external',  (_e, url) => shell.openExternal(url));
  ipcMain.handle('app:open-full',      ()         => shell.openExternal(backend.getUrl()));
  ipcMain.handle('app:minimize-tray',  ()         => mainWindow?.hide());
  ipcMain.handle('app:get-settings',   ()         => ({ ...settings }));
  ipcMain.handle('app:set-setting',    (_e, k, v) => { settings[k] = v; saveSettings(); if (k === 'autoLaunch') setupAutoLaunch(); return true; });

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
  ipcMain.on('window:close',    () => mainWindow?.hide());

  backend.on('status', (d) => mainWindow?.webContents?.send('backend:status-update', d));

  // ── Licensing ────────────────────────────────────────────────────────────
  ipcMain.handle('license:get-status', () => licenseManager.getLicenseStatus());
  ipcMain.handle('license:apply', (_e, licenseString) => licenseManager.applyLicense(licenseString));

  // ── PDF ↔ Markdown conversion ──────────────────────────────────────────

  /** Open a file-picker and return the chosen path (or null) */
  ipcMain.handle('dialog:open-file', async (_e, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? null : result.filePaths[0];
  });

  /** Show a save-file picker and return the chosen path (or null) */
  ipcMain.handle('dialog:save-file', async (_e, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result.canceled ? null : result.filePath;
  });

  /** Write arbitrary text to a file path chosen by the renderer */
  ipcMain.handle('fs:write-text', (_e, filePath, content) => {
    try { fs.writeFileSync(filePath, content, 'utf8'); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  /** Write base64 image data to a file path */
  ipcMain.handle('fs:write-binary', (_e, filePath, base64Data) => {
    try {
      // Remove data url prefix if present e.g. "data:image/png;base64,"
      const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(filePath, buffer);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /** Convert PDF → Markdown using pdf-parse (runs in main process) */
  ipcMain.handle('convert:pdf-to-md', async (_e, pdfPath) => {
    try {
      // Lazy-require so startup isn't slowed down
      const pdfParse = require('pdf-parse');
      const buffer   = fs.readFileSync(pdfPath);
      const data     = await pdfParse(buffer);

      // Build basic Markdown from extracted text
      const filename = path.basename(pdfPath, '.pdf');
      const lines    = data.text.split('\n');
      let markdown   = `# ${filename}\n\n`;

      let inPara = false;
      for (const raw of lines) {
        const line = raw.trimEnd();
        if (line.trim() === '') {
          if (inPara) { markdown += '\n\n'; inPara = false; }
        } else {
          // Heuristic: short ALL-CAPS or title-case isolated lines → heading
          const trimmed = line.trim();
          if (trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
            if (inPara) { markdown += '\n\n'; inPara = false; }
            markdown += `## ${trimmed}\n\n`;
          } else {
            markdown += (inPara ? ' ' : '') + trimmed;
            inPara = true;
          }
        }
      }

      return { ok: true, markdown, pages: data.numpages, info: data.info };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /** Convert Markdown → PDF using markdown-it + Electron printToPDF */
  ipcMain.handle('convert:md-to-pdf', async (_e, markdownContent, outputPath) => {
    return new Promise((resolve) => {
      const htmlBody = md.render(markdownContent);
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.7;
    color: #222;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 60px;
  }
  h1,h2,h3,h4 { color: #1a1a2e; margin-top: 1.4em; }
  h1 { font-size: 2em; border-bottom: 2px solid #d5aa6d; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.2em; }
  code { background:#f4f4f4; border-radius:3px; padding:2px 5px; font-size:0.9em; }
  pre  { background:#f4f4f4; border-radius:6px; padding:16px; overflow:auto; }
  pre code { background:none; padding:0; }
  blockquote { border-left:4px solid #d5aa6d; margin:0; padding:0 16px; color:#555; }
  table { border-collapse:collapse; width:100%; }
  th,td { border:1px solid #ddd; padding:8px 12px; }
  th { background:#f9f3e8; }
  a  { color:#b0813c; }
  img { max-width:100%; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>${htmlBody}</body>
</html>`;

      const win = new BrowserWindow({
        show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      });

      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));

      win.webContents.once('did-finish-load', async () => {
        try {
          const pdfBuffer = await win.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          });
          fs.writeFileSync(outputPath, pdfBuffer);
          win.destroy();
          resolve({ ok: true });
        } catch (err) {
          win.destroy();
          resolve({ ok: false, error: err.message });
        }
      });
    });
  });
}

// ── app lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  loadSettings();

  backend = new BackendManager({
    port:    settings.port,
    jrePath: getJreBinPath(),
    jarPath: getJarPath(),
    dataDir: path.join(app.getPath('userData'), 'data'),
  });

  createMainWindow();
  createTray();
  setupIPC();

  if (settings.autoStart) backend.start();
  if (!isDev) setupAutoLaunch();
});

app.on('second-instance',   showWindow);
app.on('before-quit',       () => { isQuitting = true; });
app.on('will-quit',         () => backend?.destroy());
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && isQuitting) app.quit(); });
