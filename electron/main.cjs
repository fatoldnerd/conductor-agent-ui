const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { execFile } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { listIntegrationRecipes, planIntegrationInstall } = require('./integrationRecipes.cjs');

const execFileAsync = promisify(execFile);
const isDev = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development';

const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:']);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#08090a',
    title: 'Conductor',
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    const parsed = safeUrl(url);
    if (parsed && ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const parsed = safeUrl(url);
    const expected = isDev ? process.env.VITE_DEV_SERVER_URL : `file://${path.join(__dirname, '../dist/index.html')}`;
    const expectedOrigin = safeUrl(expected)?.origin;
    if (parsed?.origin !== expectedOrigin) {
      event.preventDefault();
    }
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return win;
}

function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

async function commandVersion(command, args = ['--version']) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 5000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return {
      available: true,
      version: String(stdout || stderr).trim().split('\n')[0] || 'available',
    };
  } catch (error) {
    return {
      available: false,
      version: null,
      error: error.code === 'ENOENT' ? 'not found' : String(error.message || error),
    };
  }
}

ipcMain.handle('system:getInfo', async () => ({
  appVersion: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  osRelease: os.release(),
  hostname: os.hostname(),
  homeDir: os.homedir(),
}));

ipcMain.handle('system:checkPrerequisites', async () => {
  const checks = await Promise.all([
    ['git', commandVersion('git')],
    ['node', commandVersion('node')],
    ['npm', commandVersion('npm')],
    ['pnpm', commandVersion('pnpm')],
    ['python3', commandVersion('python3')],
    ['uv', commandVersion('uv')],
    ['pipx', commandVersion('pipx')],
    ['gh', commandVersion('gh')],
    ['docker', commandVersion('docker')],
    ['hermes', commandVersion('hermes')],
    ['claude', commandVersion('claude')],
    ['codex', commandVersion('codex')],
    ['gemini', commandVersion('gemini')],
  ]);

  return Object.fromEntries(await Promise.all(checks.map(async ([name, resultPromise]) => [name, await resultPromise])));
});

ipcMain.handle('integrations:listRecipes', async () => listIntegrationRecipes());

ipcMain.handle('integrations:planInstall', async (_event, recipeId) => {
  if (typeof recipeId !== 'string' || !/^[a-z0-9-]+$/.test(recipeId)) {
    throw new Error('Invalid integration id');
  }
  return planIntegrationInstall(recipeId, process.platform);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
