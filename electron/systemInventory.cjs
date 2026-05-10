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
    readdir: fs.readdir,
  };
}

function firstLine(value) {
  return String(value || '').trim().split('\n').find(Boolean) || null;
}

function diagnosticKindFor(command, output) {
  const value = `${command || ''}\n${output || ''}`.toLowerCase();
  if (value.includes('corepack') || value.includes('package manager')) return 'package_manager_shim';
  if (
    value.includes('permission denied') ||
    value.includes('eacces') ||
    value.includes('eperm') ||
    value.includes('operation not permitted')
  ) return 'permission';
  if (value.includes('syntaxerror') || value.includes('typeerror') || value.includes('stack trace')) return 'runtime_error';
  return 'version_check_failed';
}

function sanitizeDiagnosticSummary(command, output) {
  const kind = diagnosticKindFor(command, output);
  if (kind === 'package_manager_shim') {
    return `${command} was found, but its version check failed in a package manager shim. Check Corepack or package-manager configuration, then refresh inventory.`;
  }
  if (kind === 'permission') {
    return `${command} was found, but Conductor could not run its version check because of local permissions. Fix the local install, then refresh inventory.`;
  }
  if (kind === 'runtime_error') {
    return `${command} was found, but its version check crashed during desktop inventory. Reinstall or repair the local runtime, then refresh inventory.`;
  }
  return `${command} was found, but its version check failed during desktop inventory. Fix the local install, then refresh inventory.`;
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

function userManagedBinDirs(home) {
  return [
    path.join(home, '.npm-global', 'bin'),
    path.join(home, '.npm', 'bin'),
    path.join(home, '.local', 'bin'),
    path.join(home, '.volta', 'bin'),
    path.join(home, '.asdf', 'shims'),
    path.join(home, '.bun', 'bin'),
    path.join(home, '.cargo', 'bin'),
    path.join(home, '.deno', 'bin'),
    path.join(home, '.pnpm-global', 'bin'),
    path.join(home, 'Library', 'pnpm'),
    path.join(home, '.yarn', 'bin'),
    path.join(home, '.config', 'yarn', 'global', 'node_modules', '.bin'),
    path.join(home, 'bin'),
  ];
}

async function nvmNodeBinDirs(deps) {
  if (typeof deps.readdir !== 'function') return [];
  const root = path.join(deps.homedir(), '.nvm', 'versions', 'node');
  try {
    const entries = await deps.readdir(root);
    return entries.filter(Boolean).map((entry) => path.join(root, entry, 'bin'));
  } catch {
    return [];
  }
}

async function commandSearchDirs(deps) {
  const envPath = String(deps.env?.PATH || process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean);
  const home = deps.homedir();
  const [nvmDirs] = await Promise.all([nvmNodeBinDirs(deps)]);
  return [...new Set([
    ...envPath,
    ...COMMON_COMMAND_DIRS,
    ...userManagedBinDirs(home),
    ...nvmDirs,
  ])];
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
  return { ok: true, found: true, stdout: String(stdout || ''), stderr: String(stderr || '') };
}

async function resolveViaLoginShell(deps, command) {
  if (deps.platform !== 'darwin' || !safeCommandName(command)) return null;
  const shell = '/bin/zsh';
  const dirs = await commandSearchDirs(deps);
  const pathPrefix = dirs.join(path.delimiter);
  // `zsh -lc` sources ~/.zprofile but not ~/.zshrc; many macOS users keep nvm,
  // volta, and asdf init in .zshrc, so source it explicitly. We only ask the
  // shell to print the resolved absolute path — execution happens via execFile
  // below so we never hand the shell anything beyond the static command name.
  const script = `if [ -f "$HOME/.zshrc" ]; then . "$HOME/.zshrc" >/dev/null 2>&1 || true; fi; export PATH=${shellQuote(pathPrefix)}:$PATH; command -v ${command} 2>/dev/null || true`;
  try {
    const result = await execTool(deps, shell, ['-lc', script], {
      env: {
        ...(deps.env || process.env),
        PATH: `${pathPrefix}${path.delimiter}${deps.env?.PATH || process.env.PATH || ''}`,
      },
    });
    const resolved = String(result.stdout || '').trim().split('\n').find(Boolean);
    if (!resolved || !path.isAbsolute(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}

async function runViaLoginShell(deps, command, args = []) {
  const resolved = await resolveViaLoginShell(deps, command);
  if (!resolved) return null;
  try {
    return await execTool(deps, resolved, args);
  } catch (error) {
    return {
      ok: false,
      found: true,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || ''),
      error: isNotFound(error) ? 'not found' : String(error.message || error),
    };
  }
}

function enrichedCommandEnv(deps, dirs) {
  const existingPath = deps.env?.PATH || process.env.PATH || '';
  const pathPrefix = dirs.join(path.delimiter);
  return {
    ...(deps.env || process.env),
    PATH: `${pathPrefix}${path.delimiter}${existingPath}`,
  };
}

async function runCommand(deps, command, args = []) {
  const dirs = await commandSearchDirs(deps);
  const env = enrichedCommandEnv(deps, dirs);
  try {
    return await execTool(deps, command, args, { env });
  } catch (error) {
    const directError = {
      ok: false,
      found: !isNotFound(error),
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || ''),
      error: isNotFound(error) ? 'not found' : String(error.message || error),
    };

    if (!isNotFound(error)) return directError;

    for (const dir of dirs) {
      const candidate = path.join(dir, command);
      try {
        return await execTool(deps, candidate, args, { env });
      } catch (candidateError) {
        if (!isNotFound(candidateError)) {
          return {
            ok: false,
            found: true,
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
    const detectedButFailed = Boolean(result.found);
    const errorOutput = `${result.error || ''}\n${result.stderr || ''}\n${result.stdout || ''}`;
    return {
      id,
      label,
      command,
      category,
      recipeId,
      available: false,
      status: detectedButFailed ? 'broken' : 'missing',
      version: null,
      error: detectedButFailed ? sanitizeDiagnosticSummary(command, errorOutput) : result.error,
      diagnosticKind: detectedButFailed ? diagnosticKindFor(command, errorOutput) : undefined,
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
    status: detail.status || (running ? 'running' : 'stopped'),
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

function processLineForPid(processOutput, pid) {
  if (!pid) return '';
  return String(processOutput || '').split(/\r?\n/).find((line) => new RegExp(`^\\s*${pid}\\b`).test(line)) || '';
}

function listenerForPort(output, port) {
  const lines = String(output || '').split(/\r?\n/).filter((line) => hasPort(line, port));
  for (const line of lines) {
    const ssMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
    if (ssMatch) return { ownerCommand: ssMatch[1], pid: ssMatch[2] };

    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[0].toUpperCase() !== 'COMMAND') {
      return { ownerCommand: parts[0], pid: /^\d+$/.test(parts[1]) ? parts[1] : null };
    }
  }
  return null;
}

function commandLooksLikeSsh(command, processLine = '') {
  const commandName = String(command || '').toLowerCase();
  const line = String(processLine || '').toLowerCase();
  return commandName === 'ssh' || commandName.endsWith('/ssh') || /\bssh\b/.test(line);
}

function commandLooksHermesCompatible(command, processLine, serviceNeedles) {
  const haystack = `${command || ''}\n${processLine || ''}`.toLowerCase();
  return includesAny(haystack, ['hermes', ...serviceNeedles]);
}

function hermesPortServiceStatus({ id, label, port, portOutput, processOutput, serviceNeedles }) {
  const listener = listenerForPort(portOutput, port);
  const ownerProcessLine = listener ? processLineForPid(processOutput, listener.pid) : '';
  const processEvidence = includesAny(processOutput, serviceNeedles);
  const ownerIsHermes = listener && commandLooksHermesCompatible(listener.ownerCommand, ownerProcessLine, serviceNeedles);

  if (ownerIsHermes || (!listener && processEvidence)) {
    return serviceStatus(id, label, true, { port, detection: 'hermes_process' });
  }

  if (listener) {
    const ownerKind = commandLooksLikeSsh(listener.ownerCommand, ownerProcessLine) ? 'ssh_tunnel' : 'other_process';
    return serviceStatus(id, label, false, {
      port,
      status: 'port_in_use',
      portState: ownerKind,
      detail: ownerKind === 'ssh_tunnel'
        ? 'Port is in use by an SSH tunnel, not a confirmed local Hermes service.'
        : 'Port is in use, but the owning process was not identified as Hermes.',
    });
  }

  return serviceStatus(id, label, false, { port });
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
      hermesDashboard: hermesPortServiceStatus({
        id: 'hermesDashboard',
        label: 'Hermes dashboard',
        port: 9119,
        portOutput,
        processOutput,
        serviceNeedles: ['hermes dashboard'],
      }),
      hermesApi: hermesPortServiceStatus({
        id: 'hermesApi',
        label: 'Hermes API server',
        port: 8642,
        portOutput,
        processOutput,
        serviceNeedles: ['api-server', 'api_server'],
      }),
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
