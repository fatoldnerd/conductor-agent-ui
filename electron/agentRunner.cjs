const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');

// Read-only allowlist of agent runtime recipes. The renderer never sends
// command strings, args, env, or shell snippets — it sends a structured
// { runtimeId, projectPath, prompt, mode } payload, and this module owns
// everything that becomes a real process on disk.
const RUNTIMES = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    command: 'claude',
    description: 'Anthropic terminal-native coding agent (read-only Plan mode).',
    supportedModes: ['read-only'],
    // Plan mode disables file/network/tool execution and is the closest
    // built-in read-only posture. Flag names track the upstream Claude
    // Code CLI; if Anthropic renames them we will update this recipe.
    buildArgs: ({ prompt }) => ['-p', prompt, '--permission-mode', 'plan'],
    notes: ['Uses --permission-mode=plan to keep the run read-only.'],
    needsValidation: false,
  },
  {
    id: 'codex-cli',
    label: 'Codex CLI',
    command: 'codex',
    description: 'OpenAI Codex CLI (read-only sandbox).',
    supportedModes: ['read-only'],
    // `codex exec --sandbox read-only` is the documented read-only sandbox.
    // We pass --cd so codex starts in the validated workspace without us
    // having to hand the shell anything beyond an allowlisted argv.
    buildArgs: ({ projectPath, prompt }) => ['exec', '--sandbox', 'read-only', '--cd', projectPath, prompt],
    notes: ['Uses `codex exec --sandbox read-only` for filesystem-read-only execution.'],
    needsValidation: false,
  },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    command: 'gemini',
    description: 'Google Gemini CLI (best-effort read-only invocation).',
    supportedModes: ['read-only'],
    // Gemini CLI does not currently expose a stable read-only sandbox flag
    // we can rely on across versions. We invoke a single non-interactive
    // prompt via `-p` and intentionally keep the recipe disabled at the
    // recipe level until invocation syntax is verified end-to-end. The
    // renderer sees `available: false` for this runtime via the
    // `needsValidation` flag and the Start button stays disabled.
    buildArgs: ({ prompt }) => ['-p', prompt],
    notes: [
      'Gemini CLI invocation has no documented read-only sandbox; recipe is gated until validated.',
    ],
    needsValidation: true,
  },
];

const SUPPORTED_MODES = new Set(['read-only']);
const MAX_PROMPT_LENGTH = 16_000;
const MAX_OUTPUT_BYTES = 256 * 1024;
const RUN_ID_PATTERN = /^agent_[a-zA-Z0-9_-]+$/;

function listAgentRuntimes() {
  return RUNTIMES.map((runtime) => ({
    id: runtime.id,
    label: runtime.label,
    description: runtime.description,
    command: runtime.command,
    supportedModes: [...runtime.supportedModes],
    notes: [...runtime.notes],
    needsValidation: runtime.needsValidation,
  }));
}

function getRuntime(runtimeId) {
  if (typeof runtimeId !== 'string') throw new Error('runtimeId must be a string');
  const runtime = RUNTIMES.find((candidate) => candidate.id === runtimeId);
  if (!runtime) throw new Error(`Unknown agent runtime: ${runtimeId}`);
  return runtime;
}

function validateMode(mode) {
  if (typeof mode !== 'string' || !SUPPORTED_MODES.has(mode)) {
    throw new Error(`Unsupported agent run mode: ${mode}`);
  }
  return mode;
}

function validatePrompt(prompt) {
  if (typeof prompt !== 'string') throw new Error('Prompt must be a string');
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error('Prompt is required');
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt exceeds ${MAX_PROMPT_LENGTH} characters`);
  }
  if (trimmed.includes('\0')) throw new Error('Prompt contains a null byte');
  return trimmed;
}

function validateProjectPath(projectPath, deps = {}) {
  if (typeof projectPath !== 'string' || !projectPath.length) {
    throw new Error('projectPath is required');
  }
  if (projectPath.includes('\0')) {
    throw new Error('projectPath contains a null byte');
  }
  if (!path.isAbsolute(projectPath)) {
    throw new Error('projectPath must be an absolute path');
  }
  const normalized = path.normalize(projectPath);
  if (normalized === '/' || normalized === path.parse(normalized).root) {
    throw new Error('projectPath cannot be the filesystem root');
  }
  const statSync = deps.statSync || fs.statSync;
  let stats;
  try {
    stats = statSync(normalized);
  } catch (error) {
    throw new Error(`projectPath does not exist: ${error.code || error.message}`);
  }
  if (!stats.isDirectory()) {
    throw new Error('projectPath must be a directory');
  }
  return normalized;
}

function buildRunSpec(payload, deps = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Agent run payload is required');
  }
  // Defensive: the renderer must not be able to slip in command/args/env.
  for (const reservedKey of ['command', 'args', 'env', 'shell', 'argv']) {
    if (reservedKey in payload) {
      throw new Error(`Renderer cannot supply ${reservedKey}`);
    }
  }

  const runtime = getRuntime(payload.runtimeId);
  const mode = validateMode(payload.mode);
  if (!runtime.supportedModes.includes(mode)) {
    throw new Error(`Runtime ${runtime.id} does not support mode ${mode}`);
  }
  if (runtime.needsValidation) {
    throw new Error(`Runtime ${runtime.id} is gated pending validation; not yet runnable.`);
  }
  const projectPath = validateProjectPath(payload.projectPath, deps);
  const prompt = validatePrompt(payload.prompt);

  const args = runtime.buildArgs({ projectPath, prompt, mode });
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new Error(`Runtime ${runtime.id} produced an invalid argv`);
  }

  return {
    runtimeId: runtime.id,
    command: runtime.command,
    args,
    cwd: projectPath,
    mode,
    prompt,
  };
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
  if (!home) return [];
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

function nvmNodeBinDirs(home) {
  if (!home) return [];
  const root = path.join(home, '.nvm', 'versions', 'node');
  try {
    return fs.readdirSync(root).filter(Boolean).map((entry) => path.join(root, entry, 'bin'));
  } catch {
    return [];
  }
}

function agentPath() {
  const home = process.env.HOME;
  const envPath = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  return [...new Set([
    ...envPath,
    ...COMMON_COMMAND_DIRS,
    ...userManagedBinDirs(home),
    ...nvmNodeBinDirs(home),
  ])].join(path.delimiter);
}

function sanitizedEnv() {
  const safe = {
    HOME: process.env.HOME,
    USER: process.env.USER,
    LOGNAME: process.env.LOGNAME,
    LANG: process.env.LANG || 'en_US.UTF-8',
    LC_ALL: process.env.LC_ALL,
    PATH: agentPath(),
    TERM: 'dumb',
  };
  return Object.fromEntries(Object.entries(safe).filter(([, value]) => typeof value === 'string' && value.length > 0));
}

class AgentRunController {
  constructor(deps = {}) {
    this.runs = new Map();
    this.spawn = deps.spawn || spawn;
    this.statSync = deps.statSync || fs.statSync;
    this.now = deps.now || (() => new Date());
    this.randomId = deps.randomId || (() => crypto.randomBytes(6).toString('hex'));
  }

  list() {
    return [...this.runs.values()].map((entry) => this.snapshot(entry));
  }

  snapshot(entry) {
    return {
      runId: entry.runId,
      runtimeId: entry.runtimeId,
      command: entry.command,
      args: [...entry.args],
      cwd: entry.cwd,
      mode: entry.mode,
      status: entry.status,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      exitCode: entry.exitCode,
      bytesEmitted: entry.bytesEmitted,
    };
  }

  start(payload) {
    const spec = buildRunSpec(payload, { statSync: this.statSync });
    const runId = `agent_${this.now().getTime().toString(36)}_${this.randomId()}`;
    const emitter = new EventEmitter();
    const startedAt = this.now().toISOString();
    const entry = {
      runId,
      runtimeId: spec.runtimeId,
      command: spec.command,
      args: spec.args,
      cwd: spec.cwd,
      mode: spec.mode,
      prompt: spec.prompt,
      status: 'starting',
      startedAt,
      finishedAt: null,
      exitCode: null,
      bytesEmitted: 0,
      emitter,
      child: null,
    };

    let child;
    try {
      child = this.spawn(spec.command, spec.args, {
        cwd: spec.cwd,
        env: sanitizedEnv(),
        shell: false,
        windowsHide: true,
      });
    } catch (error) {
      entry.status = 'failed';
      entry.finishedAt = this.now().toISOString();
      entry.exitCode = -1;
      this.runs.set(runId, entry);
      queueMicrotask(() => {
        emitter.emit('event', { runId, type: 'error', message: String(error && error.message || error) });
        emitter.emit('event', { runId, type: 'status', status: 'failed', exitCode: -1, finishedAt: entry.finishedAt });
      });
      return { runId, snapshot: this.snapshot(entry), emitter };
    }

    entry.child = child;
    entry.status = 'running';
    this.runs.set(runId, entry);

    const wrap = (stream, type) => {
      if (!stream || typeof stream.on !== 'function') return;
      stream.on('data', (chunk) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        const remaining = MAX_OUTPUT_BYTES - entry.bytesEmitted;
        if (remaining <= 0) return;
        const payload = text.length > remaining ? `${text.slice(0, remaining)}\n[truncated]` : text;
        entry.bytesEmitted += payload.length;
        emitter.emit('event', { runId, type, chunk: payload });
      });
    };

    wrap(child.stdout, 'stdout');
    wrap(child.stderr, 'stderr');

    if (typeof child.on === 'function') {
      child.on('error', (error) => {
        emitter.emit('event', { runId, type: 'error', message: String(error && error.message || error) });
      });
      child.on('close', (code, signal) => {
        entry.status = signal ? 'cancelled' : code === 0 ? 'succeeded' : 'failed';
        entry.exitCode = typeof code === 'number' ? code : null;
        entry.finishedAt = this.now().toISOString();
        emitter.emit('event', {
          runId,
          type: 'status',
          status: entry.status,
          exitCode: entry.exitCode,
          signal: signal || null,
          finishedAt: entry.finishedAt,
        });
      });
    }

    queueMicrotask(() => {
      emitter.emit('event', {
        runId,
        type: 'status',
        status: 'running',
        startedAt,
      });
    });

    return { runId, snapshot: this.snapshot(entry), emitter };
  }

  stop(runId) {
    if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) {
      throw new Error('Invalid run id');
    }
    const entry = this.runs.get(runId);
    if (!entry) throw new Error(`Unknown agent run: ${runId}`);
    if (!['starting', 'running'].includes(entry.status)) {
      return this.snapshot(entry);
    }
    if (entry.child && typeof entry.child.kill === 'function') {
      try {
        entry.child.kill('SIGTERM');
      } catch {
        // ignore — close handler still finalizes state
      }
    }
    entry.status = 'cancelling';
    return this.snapshot(entry);
  }

  get(runId) {
    if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) {
      throw new Error('Invalid run id');
    }
    const entry = this.runs.get(runId);
    if (!entry) throw new Error(`Unknown agent run: ${runId}`);
    return this.snapshot(entry);
  }
}

const defaultController = new AgentRunController();

function startAgentRun(payload, { onEvent } = {}) {
  const result = defaultController.start(payload);
  if (typeof onEvent === 'function') {
    result.emitter.on('event', (event) => onEvent(event));
  }
  return { runId: result.runId, snapshot: result.snapshot };
}

function stopAgentRun(runId) {
  return defaultController.stop(runId);
}

function getAgentRun(runId) {
  return defaultController.get(runId);
}

function listAgentRuns() {
  return defaultController.list();
}

module.exports = {
  AgentRunController,
  RUN_ID_PATTERN,
  buildRunSpec,
  getAgentRun,
  listAgentRuns,
  listAgentRuntimes,
  startAgentRun,
  stopAgentRun,
  validateMode,
  validatePrompt,
  validateProjectPath,
};
