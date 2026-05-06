const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const UNSAFE_PATTERNS = [
  /\b(token|secret|api[_-]?key|password)\s*=\s*[^\s,;]+/gi,
  /\/Users\/[^\s,;]+/g,
  /\/home\/[^\s,;]+/g,
  /\/root\/[^\s,;]+/g,
];

const REQUIRED_FIELDS = [
  'schemaVersion',
  'status',
  'correlationId',
  'confirmedAt',
  'runtimeId',
  'actionKind',
  'source',
  'nativeConfirmation',
  'execution',
  'message',
];

let runtimeActionNativeConfirmationPath = process.env.CONDUCTOR_RUNTIME_ACTION_NATIVE_CONFIRMATIONS
  || path.join(os.tmpdir(), 'conductor-runtime-action-native-confirmations.jsonl');

function setRuntimeActionNativeConfirmationPath(nextPath) {
  if (typeof nextPath !== 'string' || nextPath.trim().length === 0) {
    throw new Error('Runtime action native confirmation path must be a non-empty string');
  }
  runtimeActionNativeConfirmationPath = nextPath;
}

function appendRuntimeActionNativeConfirmationResults(confirmations) {
  if (!Array.isArray(confirmations)) throw new Error('Runtime action native confirmation append requires an array');
  const validated = confirmations.map((confirmation) => assertValidConfirmation(confirmation));
  const invalid = validated.find((confirmation) => !isPersistableConfirmation(confirmation));
  if (invalid) throw new Error(`Runtime action native confirmation persistence rejected executable or non-executing-invalid outcome: ${invalid.correlationId}`);
  const sanitized = validated.map((confirmation) => sanitizeConfirmationForStore(confirmation));
  if (sanitized.length === 0) return buildReadResult([]);

  fs.mkdirSync(path.dirname(runtimeActionNativeConfirmationPath), { recursive: true });
  fs.appendFileSync(runtimeActionNativeConfirmationPath, `${sanitized.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');
  return buildReadResult(readConfirmationsFromDisk());
}

function readRuntimeActionNativeConfirmations() {
  try {
    if (!fs.existsSync(runtimeActionNativeConfirmationPath)) return buildReadResult([]);
    return buildReadResult(readConfirmationsFromDisk());
  } catch {
    return {
      schemaVersion: 1,
      status: 'unavailable',
      confirmations: [],
      message: 'Runtime action native confirmation storage is unavailable. Details were redacted for display.',
    };
  }
}

function readConfirmationsFromDisk() {
  return fs.readFileSync(runtimeActionNativeConfirmationPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseConfirmationLine)
    .filter(Boolean)
    .map((confirmation) => sanitizeConfirmationForStore(confirmation))
    .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));
}

function parseConfirmationLine(line) {
  try {
    return assertValidConfirmation(JSON.parse(line));
  } catch {
    return null;
  }
}

function buildReadResult(confirmations) {
  if (confirmations.length === 0) {
    return {
      schemaVersion: 1,
      status: 'empty',
      confirmations: [],
      message: 'No runtime action native confirmations have been recorded yet. Conductor will not show fake confirmations.',
    };
  }
  return {
    schemaVersion: 1,
    status: 'ready',
    confirmations,
    message: 'Runtime action native confirmations were read from local desktop storage.',
  };
}

function assertValidConfirmation(confirmation) {
  if (!confirmation || typeof confirmation !== 'object' || Array.isArray(confirmation)) {
    throw new Error('Invalid runtime action native confirmation: expected object');
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in confirmation)) throw new Error(`Invalid runtime action native confirmation: missing ${field}`);
  }
  if (confirmation.schemaVersion !== 1) throw new Error('Invalid runtime action native confirmation: unsupported schemaVersion');
  if (!confirmation.nativeConfirmation || typeof confirmation.nativeConfirmation !== 'object') throw new Error('Invalid runtime action native confirmation: nativeConfirmation must be object');
  if (!confirmation.execution || typeof confirmation.execution !== 'object') throw new Error('Invalid runtime action native confirmation: execution must be object');
  return confirmation;
}

function isPersistableConfirmation(confirmation) {
  if (!['confirmed_no_execution', 'cancelled_no_execution', 'invalid'].includes(confirmation.status)) return false;
  if (confirmation.execution.rendererCanExecute !== false || confirmation.execution.executed !== false) return false;
  if (confirmation.nativeConfirmation.implemented !== true) return false;
  if (confirmation.status === 'confirmed_no_execution') return confirmation.nativeConfirmation.confirmed === true && confirmation.nativeConfirmation.shown === true;
  if (confirmation.status === 'cancelled_no_execution') return confirmation.nativeConfirmation.confirmed === false && confirmation.nativeConfirmation.shown === true;
  return confirmation.nativeConfirmation.confirmed === false;
}

function sanitizeConfirmationForStore(confirmation) {
  return {
    ...confirmation,
    runtimeId: redactText(confirmation.runtimeId),
    actionKind: redactText(confirmation.actionKind),
    source: redactText(confirmation.source),
    nativeConfirmation: {
      ...confirmation.nativeConfirmation,
      reason: redactText(confirmation.nativeConfirmation.reason),
    },
    execution: {
      ...confirmation.execution,
      rendererCanExecute: false,
      executed: false,
      reason: redactText(confirmation.execution.reason),
    },
    message: redactText(confirmation.message),
  };
}

function redactText(value) {
  return UNSAFE_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), String(value));
}

function __unsafeWriteRawForTest(content) {
  fs.mkdirSync(path.dirname(runtimeActionNativeConfirmationPath), { recursive: true });
  fs.writeFileSync(runtimeActionNativeConfirmationPath, content, 'utf8');
}

module.exports = {
  appendRuntimeActionNativeConfirmationResults,
  readRuntimeActionNativeConfirmations,
  setRuntimeActionNativeConfirmationPath,
  __unsafeWriteRawForTest,
};
