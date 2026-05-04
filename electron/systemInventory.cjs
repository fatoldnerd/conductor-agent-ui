const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile: execFileCb } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFileCb);

const TOOL_SPECS = [
  { id: 'openclaw', label: 'OpenClaw', command: 'openclaw', args: ['--version'], category: 'agent-runtime', recipeId: 'openclaw' },
  { id: 'hermes', label: 'Hermes Agent', command: 'hermes', args: ['--version'], category: 'agent-runtime', recipeId: 'hermes-agent' },
  { id: 'claude', label: 'Claude Code', command: 'claude', args: ['--version'], category: 'agent-runtime', recipeId: 'claude-code' },
  { id: 'codex', label: 'Codex CLI', command: 'codex', args: ['--version'], category: 'agent-runtime', recipeId: 'codex-cli' },
  { id: 'gemini', label: 'Gemini CLI', command: 'gemini', args: ['--version'], category: 'agent-runtime', recipeId: 'gemini-cli' },
  { id: 'git', label: 'Git', command: 'git', args: ['--version'], category: 'developer-prerequisite' },
  { id: 'node', label: 'Node.js', command: 'node', args: ['--version'], category: 'developer-prerequisite' },
  { id: 'npm', label: 'npm', command: 'npm', args: ['--version'], category: 'developer-prerequisite' },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm', args: ['--version'], category: 'developer-prerequisite' },
  { id: 'python3', label: 'Python 3', command: 'python3', args: ['--version'], category: 'developer-prerequisite' },
  { id: 'curl', label: 'curl', command: 'curl', args: ['--version'], category: 'developer-prerequisite' },
  { id: 'tmux', label: 'tmux', command: 'tmux', args: ['-V'], category: 'developer-prerequisite' },
  { id: 'vercel', label: 'Vercel CLI', command: 'vercel', args: ['--version'], category: 'deployment-tool' },
  { id: 'netlify', label: 'Netlify CLI', command: 'netlify', args: ['--version'], category: 'deployment-tool' },
];

const SECRET_KEYS = ['GITHUB_TOKEN', 'VERCEL_TOKEN', 'NETLIFY_AUTH_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

function defaultDeps() {
  return {
    homedir: os.homedir,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname,
    release: os.release,
    env: process.env,
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

const COMMON_COMMAND_DIRS = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
];

function commandSearchDirs(deps) {
  const envPath = String(deps.env?.PATH || process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean);
  return [...new Set([...envPath, ...COMMON_COMMAND_DIRS])];
}

function isNotFound(error) {
  return error?.code === 'ENOENT' || /not found|ENOENT/i.test(String(error?.message || error || ''));
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function safeCommandName(command) {
  return /^[A-Za-z0-9._-]+$/.test(command);
}

async function execTool(deps, command, args = [], extraOptions = {}) {
  const { stdout, stderr } = await deps.execFile(command, args, {
    timeout: 5000,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    ...extraOptions,
  });
  return { ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') };
}

async function runViaLoginShell(deps, command, args = []) {
  if (deps.platform !== 'darwin' || !safeCommandName(command)) return null;
  const shell = '/bin/zsh';
  const argText = args.map(shellQuote).join(' ');
  const pathPrefix = commandSearchDirs(deps).join(path.delimiter);
  const script = `PATH=${shellQuote(pathPrefix)}:$PATH; resolved=$(command -v ${command}) || exit 127; "$resolved" ${argText}`;
  try {
    return await execTool(deps, shell, ['-lc', script], {
      env: { ...(deps.env || process.env), PATH: `${pathPrefix}${path.delimiter}${deps.env?.PATH || process.env.PATH || ''}` },
    });
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || ''),
      error: isNotFound(error) || error.code === 127 ? 'not found' : String(error.message || error),
    };
  }
}

async function runCommand(deps, command, args = []) {
  try {
    return await execTool(deps, command, args);
  } catch (error) {
    const directError = {
      ok: false,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || ''),
      error: isNotFound(error) ? 'not found' : String(error.message || error),
    };

    if (!isNotFound(error)) return directError;

    for (const dir of commandSearchDirs(deps)) {
      const candidate = path.join(dir, command);
      try {
        return await execTool(deps, candidate, args);
      } catch (candidateError) {
        if (!isNotFound(candidateError)) {
          return {
            ok: false,
            stdout: String(candidateError.stdout || ''),
            stderr: String(candidateError.stderr || ''),
            error: String(candidateError.message || candidateError),
          };
        }
      }
    }

    return (await runViaLoginShell(deps, command, args)) ?? directError;
  }
}

async function checkTool(deps, spec) {
  const { id, label, command, args, category, recipeId } = spec;
  const result = await runCommand(deps, command, args);
  if (!result.ok) {
    return {
      id,
      label,
      command,
      category,
      recipeId,
      available: false,
      status: 'missing',
      version: null,
      error: result.error,
    };
  }
  return {
    id,
    label,
    command,
    category,
    recipeId,
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

async function collectServiceStatus(deps) {
  const [ports, processes] = await Promise.all([
    collectPortSnapshot(deps),
    runCommand(deps, 'ps', ['-eo', 'pid,comm,args']),
  ]);
  const portOutput = `${ports.stdout}\n${ports.stderr}`;
  const processOutput = `${processes.stdout}\n${processes.stderr}`;

  const hasProcess = (...needles) => includesAny(processOutput, needles);
  const openClawRunning = hasProcess('openclaw');

  return {
    services: {
      hermesGateway: serviceStatus('hermesGateway', 'Hermes gateway', hasProcess('hermes gateway run', 'hermes_cli.main gateway'), {}),
      hermesDashboard: serviceStatus('hermesDashboard', 'Hermes dashboard', hasPort(portOutput, 9119) || hasProcess('hermes dashboard'), { port: 9119 }),
      hermesApi: serviceStatus('hermesApi', 'Hermes API server', hasPort(portOutput, 8642) || hasProcess('api-server', 'api_server'), { port: 8642 }),
      openclaw: serviceStatus('openclaw', 'OpenClaw runtime', openClawRunning, {}),
    },
    agents: {},
  };
}

async function collectLocalInventory(overrides = {}) {
  const deps = { ...defaultDeps(), ...overrides };
  const homeDir = deps.homedir();
  const toolEntries = await Promise.all(TOOL_SPECS.map(async (spec) => [spec.id, await checkTool(deps, spec)]));
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
