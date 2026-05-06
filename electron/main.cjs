const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { execFile } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { listIntegrationRecipes, planIntegrationInstall } = require('./integrationRecipes.cjs');
const { collectLocalInventory } = require('./systemInventory.cjs');
const {
  readRuntimeActionAuditHistory,
  setRuntimeActionAuditLogPath,
} = require('./runtimeActionAuditStore.cjs');
const { readRuntimeActionApprovalQueue, setRuntimeActionApprovalQueuePath } = require('./runtimeActionApprovalQueueStore.cjs');
const {
  createInstallRun,
  getInstallRun,
  listAuditEvents,
  runInstallSequence,
  runInstallStep,
  setAuditLogPath,
} = require('./installerRunner.cjs');
const {
  getAgentRun,
  listAgentRuntimes,
  startAgentRun,
  stopAgentRun,
  validateProjectPath,
} = require('./agentRunner.cjs');

const execFileAsync = promisify(execFile);
const isDev = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development';

const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:']);
const runOwners = new Map();
const agentRunOwners = new Map();

function packagedIndexPath() {
  return path.join(__dirname, '../dist/index.html');
}

function isTrustedRendererUrl(url) {
  const parsed = safeUrl(url);
  if (!parsed) return false;
  if (isDev) return parsed.origin === safeUrl(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5273')?.origin;
  return parsed.protocol === 'file:' && path.normalize(parsed.pathname) === path.normalize(packagedIndexPath());
}

function assertTrustedSender(event) {
  if (!isTrustedRendererUrl(event.sender.getURL())) throw new Error('Untrusted renderer');
}

function assertRunOwner(event, runId) {
  assertTrustedSender(event);
  const owner = runOwners.get(runId);
  if (owner && owner !== event.sender.id) throw new Error('Install run belongs to another window');
}

function assertAgentRunOwner(event, runId) {
  assertTrustedSender(event);
  const owner = agentRunOwners.get(runId);
  if (!owner) throw new Error(`Unknown agent run: ${runId}`);
  if (owner !== event.sender.id) throw new Error('Agent run belongs to another window');
}

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
    const expected = isDev ? process.env.VITE_DEV_SERVER_URL : `file://${packagedIndexPath()}`;
    if (!isDev && parsed?.protocol === 'file:') {
      if (path.normalize(parsed.pathname) !== path.normalize(packagedIndexPath())) event.preventDefault();
      return;
    }
    const expectedOrigin = safeUrl(expected)?.origin;
    if (parsed?.origin !== expectedOrigin) {
      event.preventDefault();
    }
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5273');
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

ipcMain.handle('system:collectInventory', async (event) => {
  assertTrustedSender(event);
  return collectLocalInventory();
});

ipcMain.handle('integrations:listRecipes', async (event) => {
  assertTrustedSender(event);
  return listIntegrationRecipes();
});

ipcMain.handle('integrations:planInstall', async (event, recipeId) => {
  assertTrustedSender(event);
  if (typeof recipeId !== 'string' || !/^[a-z0-9-]+$/.test(recipeId)) {
    throw new Error('Invalid integration id');
  }
  return planIntegrationInstall(recipeId, process.platform);
});

async function confirmInstallRun(event, recipeId) {
  const recipe = listIntegrationRecipes().find((item) => item.id === recipeId);
  if (!recipe) throw new Error(`Unknown integration recipe: ${recipeId}`);
  const focusedWindow = BrowserWindow.fromWebContents(event.sender);
  const commands = recipe.install.steps.map((step, index) => `${index + 1}. ${step.title}\n${step.command}`).join('\n\n');
  const result = await dialog.showMessageBox(focusedWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Approve and run'],
    defaultId: 0,
    cancelId: 0,
    title: `Approve ${recipe.name} installer`,
    message: `Approve Conductor to execute allowlisted ${recipe.name} installer commands?`,
    detail: `Commands from the trusted main-process recipe:\n\n${commands}`,
    noLink: true,
  });
  return result.response === 1;
}

ipcMain.handle('integrations:createInstallRun', async (event, recipeId) => {
  assertTrustedSender(event);
  if (typeof recipeId !== 'string' || !/^[a-z0-9-]+$/.test(recipeId)) {
    throw new Error('Invalid integration id');
  }
  const approved = await confirmInstallRun(event, recipeId);
  if (!approved) throw new Error('Installer approval cancelled');
  const run = createInstallRun(recipeId, process.platform, {
    approved: true,
    approvedBy: 'main-process-dialog',
  });
  runOwners.set(run.id, event.sender.id);
  return run;
});

ipcMain.handle('integrations:getInstallRun', async (event, runId) => {
  assertRunOwner(event, runId);
  if (typeof runId !== 'string' || !/^run_[a-zA-Z0-9_-]+$/.test(runId)) {
    throw new Error('Invalid run id');
  }
  return getInstallRun(runId);
});

ipcMain.handle('integrations:runInstallStep', async (event, runId, stepId) => {
  assertRunOwner(event, runId);
  if (typeof runId !== 'string' || typeof stepId !== 'string') throw new Error('Invalid run or step id');
  return runInstallStep(runId, stepId, {
    onOutput: (chunk) => event.sender.send('integrations:installOutput', { runId, stepId, chunk }),
  });
});

ipcMain.handle('integrations:runInstallSequence', async (event, runId) => {
  assertRunOwner(event, runId);
  if (typeof runId !== 'string' || !/^run_[a-zA-Z0-9_-]+$/.test(runId)) {
    throw new Error('Invalid run id');
  }
  return runInstallSequence(runId, {
    onOutput: (chunk) => event.sender.send('integrations:installOutput', { runId, chunk }),
  });
});

ipcMain.handle('integrations:listAuditEvents', async (event, runId) => {
  if (runId) assertRunOwner(event, runId);
  else assertTrustedSender(event);
  return listAuditEvents(runId);
});

ipcMain.handle('runtimeActions:getAuditHistory', async (event) => {
  assertTrustedSender(event);
  return readRuntimeActionAuditHistory();
});

ipcMain.handle('runtimeActions:getApprovalQueue', async (event) => {
  assertTrustedSender(event);
  return readRuntimeActionApprovalQueue();
});

ipcMain.handle('agents:listRuntimes', async (event) => {
  assertTrustedSender(event);
  return listAgentRuntimes();
});

ipcMain.handle('agents:validateProject', async (event, projectPath) => {
  assertTrustedSender(event);
  try {
    const normalized = validateProjectPath(projectPath);
    return { valid: true, projectPath: normalized };
  } catch (error) {
    return { valid: false, error: String(error && error.message || error) };
  }
});

ipcMain.handle('agents:startRun', async (event, payload) => {
  assertTrustedSender(event);
  if (!payload || typeof payload !== 'object') throw new Error('Agent run payload must be an object');
  const safe = {
    runtimeId: payload.runtimeId,
    projectPath: payload.projectPath,
    prompt: payload.prompt,
    mode: payload.mode,
  };
  const senderId = event.sender.id;
  const result = startAgentRun(safe, {
    onEvent: (eventPayload) => {
      if (event.sender.isDestroyed && event.sender.isDestroyed()) return;
      event.sender.send('agents:runEvent', eventPayload);
    },
  });
  agentRunOwners.set(result.runId, senderId);
  return result;
});

ipcMain.handle('agents:stopRun', async (event, runId) => {
  assertAgentRunOwner(event, runId);
  return stopAgentRun(runId);
});

ipcMain.handle('agents:getRun', async (event, runId) => {
  assertAgentRunOwner(event, runId);
  return getAgentRun(runId);
});

app.whenReady().then(() => {
  setAuditLogPath(path.join(app.getPath('userData'), 'install-audit.jsonl'));
  setRuntimeActionAuditLogPath(path.join(app.getPath('userData'), 'runtime-action-audit.jsonl'));
  setRuntimeActionApprovalQueuePath(path.join(app.getPath('userData'), 'runtime-action-approval-queue.jsonl'));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
