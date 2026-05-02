const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getIntegrationRecipe, planIntegrationInstall } = require('./integrationRecipes.cjs');

const runs = new Map();
const auditEvents = [];
let auditLogPath = process.env.CONDUCTOR_AUDIT_LOG || path.join(os.tmpdir(), 'conductor-install-audit.jsonl');

function setAuditLogPath(nextPath) {
  auditLogPath = nextPath;
}

function createInstallRun(recipeId, platform = process.platform, approval = {}) {
  if (!approval.approved) throw new Error('Installer execution requires explicit approval');

  const plan = planIntegrationInstall(recipeId, platform);
  const run = {
    id: `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    recipeId,
    platform,
    status: 'ready',
    createdAt: new Date().toISOString(),
    approvedBy: approval.approvedBy || 'local-user',
    steps: plan.steps.map((step) => ({ ...step, status: 'pending', output: '', exitCode: null, startedAt: null, finishedAt: null })),
    warnings: plan.warnings,
  };

  assertRunCommandsAllowlisted(run);
  runs.set(run.id, run);
  appendAudit({ type: 'run_created', runId: run.id, recipeId, platform, approvedBy: run.approvedBy });
  return clone(run);
}

function getInstallRun(runId) {
  const run = runs.get(runId);
  if (!run) throw new Error(`Unknown install run: ${runId}`);
  return clone(run);
}

function listAuditEvents(runId) {
  return auditEvents.filter((event) => !runId || event.runId === runId).map(clone);
}

function isAllowedInstallStep(recipeId, stepId, command) {
  try {
    const recipe = getIntegrationRecipe(recipeId);
    return recipe.install.steps.some((step) => step.id === stepId && step.command === command);
  } catch {
    return false;
  }
}

async function runInstallStep(runId, stepId, options = {}) {
  const run = runs.get(runId);
  if (!run) throw new Error(`Unknown install run: ${runId}`);
  const step = run.steps.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`Unknown install step: ${stepId}`);
  if (step.status === 'running') throw new Error(`Install step already running: ${stepId}`);

  const command = options.commandOverride || step.command;
  if (!isAllowedInstallStep(run.recipeId, step.id, command)) {
    appendAudit({ type: 'step_blocked', runId, stepId, reason: 'not_allowlisted', command });
    throw new Error(`Install step is not allowlisted: ${stepId}`);
  }

  if (step.kind === 'manual') {
    step.status = 'requires_manual';
    run.status = 'requires_manual';
    appendAudit({ type: 'step_manual', runId, stepId, command });
    return clone(step);
  }

  step.status = 'running';
  step.startedAt = new Date().toISOString();
  step.output = '';
  run.status = 'running';
  appendAudit({ type: 'step_started', runId, stepId, command });

  const result = await executeAllowlistedCommand(command, {
    timeoutMs: options.timeoutMs || timeoutForStep(step),
    onOutput: (chunk) => {
      step.output += chunk;
      if (typeof options.onOutput === 'function') options.onOutput(chunk);
    },
  });

  step.exitCode = result.exitCode;
  step.finishedAt = new Date().toISOString();
  step.status = result.exitCode === 0 ? 'succeeded' : 'failed';
  step.output = trimOutput(step.output || result.output);

  run.status = run.steps.some((item) => item.status === 'failed')
    ? 'failed'
    : run.steps.every((item) => ['succeeded', 'requires_manual', 'skipped'].includes(item.status))
      ? 'succeeded'
      : 'ready';

  appendAudit({ type: 'step_finished', runId, stepId, exitCode: result.exitCode, status: step.status });
  return clone(step);
}

async function runInstallSequence(runId, options = {}) {
  const run = runs.get(runId);
  if (!run) throw new Error(`Unknown install run: ${runId}`);
  const executed = [];

  for (const step of run.steps) {
    const result = await runInstallStep(runId, step.id, options);
    executed.push(result);
    if (result.status === 'failed') break;
    if (result.status === 'requires_manual' && options.stopOnManual !== false) break;
  }

  return getInstallRun(runId);
}

function executeAllowlistedCommand(command, { timeoutMs, onOutput }) {
  return new Promise((resolve) => {
    const spec = commandToSpawnSpec(command);
    const child = spawn(spec.command, spec.args, {
      shell: false,
      windowsHide: true,
      env: sanitizedEnv(),
    });

    let output = '';
    const timer = setTimeout(() => {
      output += '\n[Conductor] Step timed out and was terminated.\n';
      child.kill('SIGTERM');
    }, timeoutMs);

    const collect = (chunk) => {
      const text = chunk.toString();
      output += text;
      if (typeof onOutput === 'function') onOutput(text);
    };

    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => {
      clearTimeout(timer);
      output += String(error.message || error);
      resolve({ exitCode: 1, output: trimOutput(output) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, output: trimOutput(output) });
    });
  });
}

function commandToSpawnSpec(command) {
  const simple = command.trim().split(/\s+/);
  const simpleCommands = new Set([
    'python3 --version',
    'git --version',
    'node --version',
    'npm --version',
    'pnpm --version',
    'hermes --version',
    'hermes doctor',
    'claude --version',
    'codex --version',
    'gemini --version',
  ]);
  if (simpleCommands.has(command)) return { command: simple[0], args: simple.slice(1) };

  // Compound commands are still exact-match allowlisted before reaching this point.
  // Run them through bash explicitly instead of shell:true so the shell boundary is visible and centralized.
  return { command: process.platform === 'win32' ? 'cmd.exe' : 'bash', args: process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command] };
}

function sanitizedEnv() {
  const safe = {
    HOME: process.env.HOME,
    USER: process.env.USER,
    LOGNAME: process.env.LOGNAME,
    LANG: process.env.LANG || 'en_US.UTF-8',
    LC_ALL: process.env.LC_ALL,
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin',
  };
  return Object.fromEntries(Object.entries(safe).filter(([, value]) => typeof value === 'string' && value.length > 0));
}

function assertRunCommandsAllowlisted(run) {
  for (const step of run.steps) {
    if (!isAllowedInstallStep(run.recipeId, step.id, step.command)) {
      throw new Error(`Recipe contains non-allowlisted step: ${step.id}`);
    }
  }
}

function timeoutForStep(step) {
  if (step.kind === 'install') return 10 * 60 * 1000;
  if (step.kind === 'configure') return 5 * 60 * 1000;
  return 30 * 1000;
}

function appendAudit(event) {
  const full = { ...event, timestamp: new Date().toISOString() };
  auditEvents.push(full);
  try {
    fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
    fs.appendFileSync(auditLogPath, `${JSON.stringify(full)}\n`, 'utf8');
  } catch (error) {
    throw new Error(`Failed to persist installer audit event: ${error.message || error}`);
  }
}

function trimOutput(output) {
  const text = String(output || '');
  return text.length > 12000 ? `${text.slice(-12000)}\n[Conductor] Output truncated to the last 12000 chars.` : text;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  createInstallRun,
  getInstallRun,
  isAllowedInstallStep,
  listAuditEvents,
  runInstallStep,
  runInstallSequence,
  setAuditLogPath,
};
