const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const UNSAFE_PATTERNS = [
  /\b(token|secret|api[_-]?key|password)\s*=\s*[^\s,;]+/gi,
  /\/Users\/[^\s,;]+/g,
  /\/home\/[^\s,;]+/g,
  /\/root\/[^\s,;]+/g,
];

const REQUIRED_DECISION_FIELDS = [
  'schemaVersion',
  'state',
  'correlationId',
  'runtimeId',
  'actionKind',
  'source',
  'decision',
  'execution',
  'auditEvents',
];

let runtimeActionApprovalDecisionPath = process.env.CONDUCTOR_RUNTIME_ACTION_APPROVAL_DECISIONS
  || path.join(os.tmpdir(), 'conductor-runtime-action-approval-decisions.jsonl');

function setRuntimeActionApprovalDecisionPath(nextPath) {
  if (typeof nextPath !== 'string' || nextPath.trim().length === 0) {
    throw new Error('Runtime action approval decision path must be a non-empty string');
  }
  runtimeActionApprovalDecisionPath = nextPath;
}

function appendRuntimeActionApprovalDecisionEnvelopes(decisions) {
  if (!Array.isArray(decisions)) throw new Error('Runtime action approval decision append requires an array of envelopes');
  const validated = decisions.map((decision) => assertValidDecisionEnvelope(decision));
  const invalid = validated.find((decision) => !isPersistableDecisionEnvelope(decision));
  if (invalid) throw new Error(`Runtime action approval decision persistence rejected invalid or renderer execution envelope: ${invalid.correlationId}`);
  const sanitized = validated.map((decision) => sanitizeDecisionEnvelopeForStore(decision));
  if (sanitized.length === 0) return buildReadResult([]);

  fs.mkdirSync(path.dirname(runtimeActionApprovalDecisionPath), { recursive: true });
  const lines = sanitized.map((decision) => JSON.stringify(decision)).join('\n');
  fs.appendFileSync(runtimeActionApprovalDecisionPath, `${lines}\n`, 'utf8');
  return buildReadResult(readDecisionsFromDisk());
}

function readRuntimeActionApprovalDecisions() {
  try {
    if (!fs.existsSync(runtimeActionApprovalDecisionPath)) return buildReadResult([]);
    return buildReadResult(readDecisionsFromDisk());
  } catch {
    return {
      schemaVersion: 1,
      status: 'unavailable',
      decisions: [],
      message: 'Runtime action approval decision storage is unavailable. Details were redacted for display.',
    };
  }
}

function readDecisionsFromDisk() {
  const content = fs.readFileSync(runtimeActionApprovalDecisionPath, 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseDecisionLine)
    .filter(Boolean)
    .map((decision) => sanitizeDecisionEnvelopeForStore(decision))
    .sort((a, b) => b.decision.decidedAt.localeCompare(a.decision.decidedAt));
}

function parseDecisionLine(line) {
  try {
    return assertValidDecisionEnvelope(JSON.parse(line));
  } catch {
    return null;
  }
}

function buildReadResult(decisions) {
  if (decisions.length === 0) {
    return {
      schemaVersion: 1,
      status: 'empty',
      decisions: [],
      message: 'No runtime action approval decisions have been recorded yet. Conductor will not show fake decisions.',
    };
  }

  return {
    schemaVersion: 1,
    status: 'ready',
    decisions,
    message: 'Runtime action approval decisions were read from local desktop storage.',
  };
}

function assertValidDecisionEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Invalid runtime action approval decision envelope: expected object');
  }
  for (const field of REQUIRED_DECISION_FIELDS) {
    if (!(field in envelope)) throw new Error(`Invalid runtime action approval decision envelope: missing ${field}`);
  }
  if (envelope.schemaVersion !== 1) throw new Error('Invalid runtime action approval decision envelope: unsupported schemaVersion');
  if (!envelope.decision || typeof envelope.decision !== 'object') throw new Error('Invalid runtime action approval decision envelope: decision must be an object');
  if (!envelope.execution || typeof envelope.execution !== 'object') throw new Error('Invalid runtime action approval decision envelope: execution must be an object');
  if (!Array.isArray(envelope.auditEvents)) throw new Error('Invalid runtime action approval decision envelope: auditEvents must be an array');
  return envelope;
}

function isPersistableDecisionEnvelope(envelope) {
  if (envelope.state === 'invalid') return false;
  if (envelope.execution.rendererCanExecute) return false;
  if (envelope.state === 'accepted_for_native_confirmation') {
    return envelope.decision.decision === 'approved'
      && envelope.execution.requiresNativeConfirmation === true
      && typeof envelope.execution.desktopApi === 'string';
  }
  if (envelope.state === 'rejected' || envelope.state === 'cancelled') {
    return envelope.execution.requiresNativeConfirmation === false && envelope.execution.desktopApi === null;
  }
  return false;
}

function sanitizeDecisionEnvelopeForStore(envelope) {
  return {
    ...envelope,
    decision: {
      ...envelope.decision,
      ...(envelope.decision.note ? { note: redactText(envelope.decision.note) } : {}),
      safeForLog: true,
    },
    execution: {
      ...envelope.execution,
      rendererCanExecute: false,
      reason: redactText(envelope.execution.reason),
    },
  };
}

function redactText(value) {
  return UNSAFE_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), String(value));
}

function __unsafeWriteRawForTest(content) {
  fs.mkdirSync(path.dirname(runtimeActionApprovalDecisionPath), { recursive: true });
  fs.writeFileSync(runtimeActionApprovalDecisionPath, content, 'utf8');
}

module.exports = {
  appendRuntimeActionApprovalDecisionEnvelopes,
  readRuntimeActionApprovalDecisions,
  setRuntimeActionApprovalDecisionPath,
  __unsafeWriteRawForTest,
};
