const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile: execFileCb } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFileCb);

const TOOL_SPECS = [
  ['hermes', 'hermes', ['--version']],
  ['openclaw', 'openclaw', ['--version']],
  ['claude', 'claude', ['--version']],
  ['codex', 'codex', ['--version']],
  ['git', 'git', ['--version']],
  ['node', 'node', ['--version']],
  ['npm', 'npm', ['--version']],
  ['pnpm', 'pnpm', ['--version']],
  ['tmux', 'tmux', ['-V']],
  ['vercel', 'vercel', ['--version']],
  ['netlify', 'netlify', ['--version']],
];

const SECRET_KEYS = ['GITHUB_TOKEN', 'VERCEL_TOKEN', 'NETLIFY_AUTH_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

function defaultDeps() {
  return {
    homedir: os.homedir,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname,
    release: os.release,
    execFile: (command, args = [], options = {}) => execFileAsync(command, args, {
      timeout: 5000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      ...options,
    }),
    access: fs.access,
    readFile: fs.readFile,
  };
}

function firstLine(value) {
  return String(value || '').trim().split('\n').find(Boolean) || null;
}

async function runCommand(deps, command, args = []) {
  try {
    const { stdout, stderr } = await deps.execFile(command, args, {
      timeout: 5000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return { ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || ''),
      error: error.code === 'ENOENT' ? 'not found' : String(error.message || error),
    };
  }
}

async function checkTool(deps, id, command, args) {
  const result = await runCommand(deps, command, args);
  if (!result.ok) {
    return {
      id,
      available: false,
      status: 'missing',
      version: null,
      error: result.error,
    };
  }
  return {
    id,
    available: true,
    status: 'ready',
    version: firstLine(result.stdout || result.stderr) || 'available',
  };
}

async function fileExists(deps, filePath) {
  try {
    await deps.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseEnvSecretPresence(content) {
  const present = {};
  const lines = String(content || '').split(/\r?\n/);
  for (const key of SECRET_KEYS) {
    present[key] = lines.some((line) => line.startsWith(`${key}=`) && line.slice(key.length + 1).trim().length > 0);
  }
  return Object.fromEntries(Object.entries(present).filter(([, value]) => value));
}

async function readConfigStatus(deps, id, filePath, includeSecrets = false) {
  const exists = await fileExists(deps, filePath);
  const status = { id, path: filePath, exists, status: exists ? 'found' : 'missing' };
  if (exists && includeSecrets) {
    try {
      const content = await deps.readFile(filePath, 'utf8');
      status.secrets = parseEnvSecretPresence(content);
    } catch {
      status.secrets = {};
    }
  }
  return status;
}

function serviceStatus(id, label, running, detail = {}) {
  return {
    id,
    label,
    running,
    status: running ? 'running' : 'stopped',
    ...detail,
  };
}

function includesAny(haystack, needles) {
  const value = String(haystack || '').toLowerCase();
  return needles.some((needle) => value.includes(needle));
}

async function collectPortSnapshot(deps) {
  const primary = await runCommand(deps, 'ss', ['-ltnp']);
  if (primary.ok) return primary;
  return runCommand(deps, 'lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']);
}

function hasPort(output, port) {
  return new RegExp(`[:.]${port}\\b`).test(String(output || ''));
}

function detectOpenClawAgents(portOutput, processOutput) {
  const processText = String(processOutput || '').toLowerCase();
  const agentSpecs = [
    ['hugo', 'Hugo', 18789],
    ['kestrel', 'Kestrel', 18790],
  ];

  return Object.fromEntries(agentSpecs.map(([id, name, port]) => {
    const running = hasPort(portOutput, port) || includesAny(processText, [id]);
    return [id, {
      id,
      name,
      platform: 'openclaw',
      running,
      status: running ? 'running' : 'stopped',
      port,
    }];
  }));
}

async function collectServiceStatus(deps) {
  const [ports, processes] = await Promise.all([
    collectPortSnapshot(deps),
    runCommand(deps, 'ps', ['-eo', 'pid,comm,args']),
  ]);
  const portOutput = `${ports.stdout}\n${ports.stderr}`;
  const processOutput = `${processes.stdout}\n${processes.stderr}`;

  const hasProcess = (...needles) => includesAny(processOutput, needles);
  const openClawAgents = detectOpenClawAgents(portOutput, processOutput);
  const openClawRunning = hasProcess('openclaw') || Object.values(openClawAgents).some((agent) => agent.running);

  return {
    services: {
      hermesGateway: serviceStatus('hermesGateway', 'Hermes gateway', hasProcess('hermes gateway run', 'hermes_cli.main gateway'), {}),
      hermesDashboard: serviceStatus('hermesDashboard', 'Hermes dashboard', hasPort(portOutput, 9119) || hasProcess('hermes dashboard'), { port: 9119 }),
      hermesApi: serviceStatus('hermesApi', 'Hermes API server', hasPort(portOutput, 8642) || hasProcess('api-server', 'api_server'), { port: 8642 }),
      openclaw: serviceStatus('openclaw', 'OpenClaw runtime', openClawRunning, {}),
    },
    agents: openClawAgents,
  };
}

async function collectLocalInventory(overrides = {}) {
  const deps = { ...defaultDeps(), ...overrides };
  const homeDir = deps.homedir();
  const toolEntries = await Promise.all(TOOL_SPECS.map(async ([id, command, args]) => [id, await checkTool(deps, id, command, args)]));
  const hermesDir = path.join(homeDir, '.hermes');

  const [serviceInventory, hermesConfig, hermesEnv, openclawConfig] = await Promise.all([
    collectServiceStatus(deps),
    readConfigStatus(deps, 'hermesConfig', path.join(hermesDir, 'config.yaml')),
    readConfigStatus(deps, 'hermesEnv', path.join(hermesDir, '.env'), true),
    readConfigStatus(deps, 'openclawConfig', path.join(homeDir, '.openclaw', 'config.yaml')),
  ]);
  const desktopCapable = ['darwin', 'win32', 'linux'].includes(deps.platform);
  const hasCoreDesktopTooling = ['git', 'node', 'npm'].every((tool) => Object.fromEntries(toolEntries)[tool]?.available);

  return {
    collectedAt: new Date().toISOString(),
    desktopSmoke: {
      bridgeExpected: true,
      platformSupported: desktopCapable,
      status: desktopCapable && hasCoreDesktopTooling ? 'ready' : 'needs_attention',
    },
    machine: {
      platform: deps.platform,
      arch: deps.arch,
      osRelease: deps.release(),
      hostname: deps.hostname(),
      homeDir,
      desktopCapable,
    },
    tools: Object.fromEntries(toolEntries),
    services: serviceInventory.services,
    agents: serviceInventory.agents,
    configs: {
      hermesConfig,
      hermesEnv,
      openclawConfig,
    },
  };
}

module.exports = {
  collectLocalInventory,
  parseEnvSecretPresence,
};
