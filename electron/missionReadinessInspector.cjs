const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { appendRuntimeActionAuditEvents } = require('./runtimeActionAuditStore.cjs');

const MISSION_API = 'mission.inspectRepoReadiness';
const MISSION_TYPE = 'repo_readiness_inspection';
const ACTION_KIND = 'mission_repo_readiness_inspection';
const ALLOWLISTED_METADATA_FILES = ['package.json', 'README.md', 'readme.md', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'pyproject.toml'];

function inspectRepoReadinessMission(request, deps = {}) {
  const safeRequest = sanitizeMissionRequest(request);
  const projectPath = normalizeProjectPath(safeRequest.projectPath);
  const fsImpl = deps.fs || fs;
  const now = deps.now || (() => new Date().toISOString());
  const randomId = deps.randomId || (() => crypto.randomBytes(6).toString('hex'));
  const appendAuditEvents = deps.appendAuditEvents || appendRuntimeActionAuditEvents;

  assertReadableDirectory(projectPath, fsImpl);

  const repoName = sanitizeRepoName(path.basename(projectPath));
  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageJson = readPackageJson(packageJsonPath, fsImpl);
  const packageScripts = packageJson && typeof packageJson.scripts === 'object' && packageJson.scripts !== null
    ? packageJson.scripts
    : {};
  const hasGitRepository = exists(path.join(projectPath, '.git'), fsImpl);
  const hasReadme = exists(path.join(projectPath, 'README.md'), fsImpl) || exists(path.join(projectPath, 'readme.md'), fsImpl);
  const hasPackageJson = Boolean(packageJson);
  const packageManager = detectPackageManager(projectPath, fsImpl, hasPackageJson);
  const hasTestScript = Boolean(packageScripts.test);
  const hasBuildScript = Boolean(packageScripts.build);
  const riskNotes = buildRiskNotes({ hasGitRepository, hasPackageJson, hasTestScript, hasBuildScript, hasReadme });
  const correlationId = `mission_${randomId()}`;

  const result = {
    schemaVersion: 1,
    status: 'succeeded',
    desktopApi: MISSION_API,
    missionType: MISSION_TYPE,
    correlationId,
    repoName,
    projectPathLabel: repoName,
    rendererCanExecuteArbitraryActions: false,
    executedShell: false,
    commandAllowlist: [],
    readOnly: true,
    allowlistedMetadataFiles: ALLOWLISTED_METADATA_FILES,
    summary: {
      hasGitRepository,
      packageManager,
      hasPackageJson,
      hasTestScript,
      hasBuildScript,
      hasReadme,
      readiness: riskNotes.length === 0 ? 'ready_for_read_only_agent_review' : 'needs_attention_before_agent_review',
      riskNotes,
    },
    message: 'Read-only repo readiness inspection completed from allowlisted metadata files. No commands were executed.',
  };

  appendAuditEvents([buildAuditEvent({ correlationId, repoName, now: now(), outcome: 'succeeded' })]);
  return result;
}

function sanitizeMissionRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('Mission inspector request must be an object');
  }
  const keys = Object.keys(request).sort();
  if (keys.length !== 1 || keys[0] !== 'projectPath') {
    throw new Error('Mission inspector accepts only a projectPath');
  }
  if (typeof request.projectPath !== 'string' || request.projectPath.trim().length === 0) {
    throw new Error('Mission inspector projectPath must be a non-empty string');
  }
  return { projectPath: request.projectPath.trim() };
}

function normalizeProjectPath(projectPath) {
  const normalized = path.resolve(projectPath);
  if (!path.isAbsolute(normalized)) throw new Error('Mission inspector projectPath must resolve to an absolute path');
  return normalized;
}

function assertReadableDirectory(projectPath, fsImpl) {
  let stat;
  try {
    stat = fsImpl.statSync(projectPath);
  } catch {
    throw new Error('Mission inspector projectPath does not exist or is not readable');
  }
  if (!stat || typeof stat.isDirectory !== 'function' || !stat.isDirectory()) {
    throw new Error('Mission inspector projectPath must be a directory');
  }
}

function exists(target, fsImpl) {
  try {
    return Boolean(fsImpl.existsSync(target));
  } catch {
    return false;
  }
}

function readPackageJson(packageJsonPath, fsImpl) {
  if (!exists(packageJsonPath, fsImpl)) return null;
  try {
    const raw = fsImpl.readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function detectPackageManager(projectPath, fsImpl, hasPackageJson) {
  if (exists(path.join(projectPath, 'pnpm-lock.yaml'), fsImpl)) return 'pnpm';
  if (exists(path.join(projectPath, 'yarn.lock'), fsImpl)) return 'yarn';
  if (exists(path.join(projectPath, 'package-lock.json'), fsImpl) || hasPackageJson) return 'npm';
  if (exists(path.join(projectPath, 'pyproject.toml'), fsImpl)) return 'python';
  return 'unknown';
}

function buildRiskNotes(summary) {
  const notes = [];
  if (!summary.hasGitRepository) notes.push('No .git directory detected from metadata scan.');
  if (!summary.hasPackageJson) notes.push('No package.json detected.');
  if (!summary.hasTestScript) notes.push('No package.json test script detected.');
  if (!summary.hasBuildScript) notes.push('No package.json build script detected.');
  if (!summary.hasReadme) notes.push('No README detected.');
  return notes;
}

function sanitizeRepoName(value) {
  const cleaned = String(value || 'repo').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
  return cleaned || 'repo';
}

function buildAuditEvent({ correlationId, repoName, now, outcome }) {
  return {
    schemaVersion: 1,
    eventType: 'runtime_action_submitted',
    occurredAt: now,
    correlationId,
    runtimeId: 'mission-control',
    desktopApi: MISSION_API,
    actionKind: ACTION_KIND,
    source: 'renderer',
    submitState: 'submitted',
    outcome,
    safeForLog: true,
    redactedFields: ['projectPath'],
    payloadSummary: `repoName=${repoName}`,
    resultMessage: 'Read-only repo readiness inspection completed without command execution.',
  };
}

module.exports = {
  inspectRepoReadinessMission,
  sanitizeMissionRequest,
};
