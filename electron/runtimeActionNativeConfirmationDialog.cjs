const {
  readRuntimeActionApprovalDecisions,
  setRuntimeActionApprovalDecisionPath,
} = require('./runtimeActionApprovalDecisionStore.cjs');
const {
  appendRuntimeActionNativeConfirmationResults,
  setRuntimeActionNativeConfirmationPath,
} = require('./runtimeActionNativeConfirmationStore.cjs');

const CORRELATION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/;
const UNSAFE_PATTERNS = [
  /\b(token|secret|api[_-]?key|password)\s*=\s*[^\s,;]+/gi,
  /\/Users\/[^\s,;]+/g,
  /\/home\/[^\s,;]+/g,
  /\/root\/[^\s,;]+/g,
];

function redactText(value) {
  return UNSAFE_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), String(value));
}

function runtimeLabel(runtimeId) {
  return String(runtimeId)
    .split('-')
    .map((part) => (part.toLowerCase() === 'cli' ? 'CLI' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Native confirmation payload must be an object');
  }
  if (typeof payload.correlationId !== 'string' || !CORRELATION_ID_PATTERN.test(payload.correlationId)) {
    throw new Error('Invalid runtime action correlation id');
  }
  return { correlationId: payload.correlationId };
}

function invalidResult(correlationId, reason) {
  return {
    schemaVersion: 1,
    status: 'invalid',
    correlationId,
    nativeConfirmation: {
      required: true,
      shown: false,
      confirmed: false,
      implemented: true,
      reason: redactText(reason),
    },
    execution: {
      rendererCanExecute: false,
      executed: false,
      reason: 'Native confirmation did not complete. Execution is not implemented.',
    },
    message: 'Native confirmation could not continue. No action executed.',
  };
}

function findConfirmableDecision(correlationId) {
  const result = readRuntimeActionApprovalDecisions();
  if (result.status === 'unavailable') throw new Error('Runtime action approval decision store is unavailable');
  const envelope = result.decisions.find((decision) => decision.correlationId === correlationId);
  if (!envelope) return { ok: false, reason: `No approval decision found for ${correlationId}` };
  if (
    envelope.state !== 'accepted_for_native_confirmation'
    || envelope.decision?.decision !== 'approved'
    || envelope.execution?.rendererCanExecute
    || envelope.execution?.requiresNativeConfirmation !== true
    || typeof envelope.execution?.desktopApi !== 'string'
  ) {
    return { ok: false, reason: `Approval decision ${correlationId} is not eligible for native confirmation` };
  }
  return { ok: true, envelope };
}

function buildDialogOptions(envelope) {
  const note = envelope.decision?.note ? `\nUser note: ${redactText(envelope.decision.note)}` : '';
  return {
    type: 'warning',
    buttons: ['Cancel', 'Confirm'],
    defaultId: 0,
    cancelId: 0,
    title: 'Confirm runtime action',
    message: 'Confirm approved runtime action?',
    detail: redactText([
      `Runtime: ${runtimeLabel(envelope.runtimeId)}`,
      `Action: ${envelope.actionKind}`,
      `Source: ${envelope.source}`,
      `API: ${envelope.execution.desktopApi}`,
      '',
      'Confirmation records consent only. Execution is not implemented in this build.',
      'Conductor will not run arbitrary shell commands from this dialog.',
      note.trim(),
    ].filter(Boolean).join('\n')),
    noLink: true,
  };
}

async function confirmRuntimeActionNativeConfirmation(payload, deps = {}) {
  let safePayload;
  try {
    safePayload = validatePayload(payload);
  } catch (error) {
    return invalidResult('invalid', error && error.message ? error.message : String(error));
  }

  const confirmable = findConfirmableDecision(safePayload.correlationId);
  if (!confirmable.ok) return invalidResult(safePayload.correlationId, confirmable.reason);

  const showMessageBox = deps.showMessageBox;
  if (typeof showMessageBox !== 'function') {
    throw new Error('Native confirmation dialog dependency is missing');
  }

  const dialogResult = await showMessageBox(deps.parentWindow || null, buildDialogOptions(confirmable.envelope));
  const confirmed = dialogResult && dialogResult.response === 1;
  const result = {
    schemaVersion: 1,
    status: confirmed ? 'confirmed_no_execution' : 'cancelled_no_execution',
    correlationId: safePayload.correlationId,
    confirmedAt: new Date().toISOString(),
    runtimeId: confirmable.envelope.runtimeId,
    actionKind: confirmable.envelope.actionKind,
    source: confirmable.envelope.source,
    nativeConfirmation: {
      required: true,
      shown: true,
      confirmed,
      implemented: true,
      reason: confirmed
        ? 'Native confirmation was accepted. Execution remains disabled.'
        : 'Native confirmation was cancelled. No action executed.',
    },
    execution: {
      rendererCanExecute: false,
      executed: false,
      reason: 'Native confirmation is implemented, but runtime action execution is not implemented.',
    },
    message: confirmed
      ? 'Native confirmation completed. No action executed.'
      : 'Native confirmation cancelled. No action executed.',
  };
  appendRuntimeActionNativeConfirmationResults([result]);
  return result;
}

function setRuntimeActionNativeConfirmationDialogPaths(input) {
  if (!input || typeof input !== 'object') throw new Error('Native confirmation path configuration must be an object');
  if (input.decisionPath) setRuntimeActionApprovalDecisionPath(input.decisionPath);
  if (input.confirmationPath) setRuntimeActionNativeConfirmationPath(input.confirmationPath);
}

module.exports = {
  confirmRuntimeActionNativeConfirmation,
  setRuntimeActionNativeConfirmationDialogPaths,
};
