const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { appendRuntimeActionAuditEvents } = require('./runtimeActionAuditStore.cjs');
const { startAgentRun } = require('./agentRunner.cjs');

const DESKTOP_API = 'mission.startReadOnlyRepoReview';
const MISSION_TYPE = 'read_only_repo_review';
const ACTION_KIND = 'mission_read_only_repo_review';
const FIXED_RUNTIME_ID = 'codex-cli';

function sanitizeRepoReviewRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('Repo review mission request must be an object');
  }
  const keys = Object.keys(request).sort();
  if (keys.length !== 1 || keys[0] !== 'projectPath') {
    throw new Error('Repo review mission accepts only projectPath');
  }
  if (typeof request.projectPath !== 'string' || request.projectPath.trim().length === 0) {
    throw new Error('Repo review mission projectPath must be a non-empty string');
  }
  if (request.projectPath.includes('\0')) throw new Error('Repo review mission projectPath contains a null byte');
  return { projectPath: request.projectPath.trim() };
}

function validateProjectPath(projectPath, statSync = fs.statSync) {
  const normalized = path.resolve(projectPath);
  if (!path.isAbsolute(normalized)) throw new Error('Repo review mission projectPath must resolve to an absolute path');
  if (normalized === '/' || normalized === path.parse(normalized).root) {
    throw new Error('Repo review mission projectPath cannot be filesystem root');
  }
  let stat;
  try {
    stat = statSync(normalized);
  } catch {
    throw new Error('Repo review mission projectPath does not exist or is not readable');
  }
  if (!stat || typeof stat.isDirectory !== 'function' || !stat.isDirectory()) {
    throw new Error('Repo review mission projectPath must be a directory');
  }
  return normalized;
}

function repoLabel(projectPath) {
  return String(path.basename(projectPath) || 'repo').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'repo';
}

function buildReadOnlyReviewPrompt(repoName) {
  return [
    'Read-only repo review mission.',
    '',
    `Repository label: ${repoName}`,
    '',
    'You are running inside Conductor as an approved read-only reviewer.',
    'Do not modify files. Do not run write operations. Do not install dependencies. Do not change git state.',
    'Inspect the repository and produce a concise review report with:',
    '- high-level purpose inferred from files',
    '- build/test readiness observations',
    '- top risks or bugs worth investigating',
    '- safe next steps for a human operator',
    '',
    'If you cannot complete the review safely, say why and stop.',
  ].join('\n');
}

function buildDialogOptions({ repoName, projectPath }) {
  return {
    type: 'warning',
    buttons: ['Cancel', 'Start review'],
    defaultId: 0,
    cancelId: 0,
    title: 'Start read-only repo review',
    message: 'Start read-only repo review mission?',
    detail: [
      `Repository: ${repoName}`,
      `Runtime: Codex CLI`,
      `Mode: read-only`,
      '',
      'Conductor will launch one fixed allowlisted Codex recipe:',
      'codex exec --sandbox read-only --cd [project] [fixed review prompt]',
      '',
      'The renderer did not provide a command, argv, shell snippet, environment, or runtime args.',
      'The project path is validated by Electron main and is redacted from audit summaries.',
      `Path label: ${repoLabel(projectPath)}`,
    ].join('\n'),
    noLink: true,
  };
}

function buildAuditEvent({ correlationId, repoName, outcome, now, resultMessage }) {
  return {
    schemaVersion: 1,
    eventType: 'runtime_action_submitted',
    occurredAt: now,
    correlationId,
    runtimeId: FIXED_RUNTIME_ID,
    desktopApi: DESKTOP_API,
    actionKind: ACTION_KIND,
    source: 'renderer',
    submitState: 'submitted',
    outcome,
    safeForLog: true,
    redactedFields: ['projectPath', 'prompt'],
    payloadSummary: `repoName=${repoName}; runtime=${FIXED_RUNTIME_ID}; mode=read-only`,
    resultMessage,
  };
}

async function startApprovedRepoReviewMission(request, deps = {}) {
  const safe = sanitizeRepoReviewRequest(request);
  const statSync = deps.statSync || fs.statSync;
  const showMessageBox = deps.showMessageBox;
  if (typeof showMessageBox !== 'function') throw new Error('Repo review mission requires native approval dialog');
  const appendAuditEvents = deps.appendAuditEvents || appendRuntimeActionAuditEvents;
  const startRun = deps.startAgentRun || startAgentRun;
  const now = deps.now || (() => new Date().toISOString());
  const randomId = deps.randomId || (() => crypto.randomBytes(6).toString('hex'));
  const projectPath = validateProjectPath(safe.projectPath, statSync);
  const repoName = repoLabel(projectPath);
  const correlationId = `mission_review_${randomId()}`;
  const dialogResult = await showMessageBox(deps.parentWindow || null, buildDialogOptions({ repoName, projectPath }));
  const confirmed = dialogResult && dialogResult.response === 1;

  appendAuditEvents([buildAuditEvent({
    correlationId,
    repoName,
    outcome: confirmed ? 'native_approval_confirmed' : 'native_approval_cancelled',
    now: now(),
    resultMessage: confirmed ? 'Native approval confirmed for read-only repo review mission.' : 'Native approval cancelled; no agent run started.',
  })]);

  if (!confirmed) {
    return {
      schemaVersion: 1,
      status: 'cancelled',
      desktopApi: DESKTOP_API,
      missionType: MISSION_TYPE,
      correlationId,
      runtimeId: FIXED_RUNTIME_ID,
      rendererCanExecuteArbitraryActions: false,
      executedShell: false,
      nativeApproval: { required: true, shown: true, confirmed: false },
      message: 'Read-only repo review mission cancelled. No agent run started.',
    };
  }

  const prompt = buildReadOnlyReviewPrompt(repoName);
  const run = startRun({
    runtimeId: FIXED_RUNTIME_ID,
    projectPath,
    prompt,
    mode: 'read-only',
  });

  appendAuditEvents([buildAuditEvent({
    correlationId,
    repoName,
    outcome: 'started',
    now: now(),
    resultMessage: `Read-only repo review mission started with ${FIXED_RUNTIME_ID}.`,
  })]);

  return {
    schemaVersion: 1,
    status: 'started',
    desktopApi: DESKTOP_API,
    missionType: MISSION_TYPE,
    correlationId,
    runtimeId: FIXED_RUNTIME_ID,
    runId: run.runId,
    snapshot: run.snapshot,
    rendererCanExecuteArbitraryActions: false,
    executedShell: false,
    nativeApproval: { required: true, shown: true, confirmed: true },
    message: 'Read-only repo review mission started with the fixed Codex CLI recipe.',
  };
}

module.exports = {
  buildReadOnlyReviewPrompt,
  sanitizeRepoReviewRequest,
  startApprovedRepoReviewMission,
};
