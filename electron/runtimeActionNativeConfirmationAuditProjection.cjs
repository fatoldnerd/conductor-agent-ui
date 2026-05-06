const UNSAFE_PATTERNS = [
  /\b(token|secret|api[_-]?key|password)\s*=\s*[^\s,;]+/gi,
  /\/Users\/[^\s,;]+/g,
  /\/home\/[^\s,;]+/g,
  /\/root\/[^\s,;]+/g,
  /\b(command|stderr|bash\s+-lc)\b/gi,
];

function redactText(value) {
  return UNSAFE_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[redacted]'), String(value || ''));
}

function assertNonExecutingConfirmation(confirmation) {
  if (!confirmation || typeof confirmation !== 'object' || Array.isArray(confirmation)) {
    throw new Error('Native confirmation audit projection requires a confirmation result object');
  }
  if (confirmation.schemaVersion !== 1) throw new Error('Native confirmation audit projection requires schemaVersion 1');
  if (!['confirmed_no_execution', 'cancelled_no_execution', 'invalid'].includes(confirmation.status)) {
    throw new Error('Native confirmation audit projection only accepts non-executing statuses');
  }
  if (!confirmation.execution || confirmation.execution.rendererCanExecute !== false || confirmation.execution.executed !== false) {
    throw new Error('Native confirmation audit projection only accepts non-executing confirmation results');
  }
  return confirmation;
}

function eventTypeForStatus(status) {
  if (status === 'confirmed_no_execution') return 'native_confirmation_confirmed';
  if (status === 'cancelled_no_execution') return 'native_confirmation_cancelled';
  return 'native_confirmation_invalid';
}

function resultStatusForStatus(status) {
  return status === 'invalid' ? 'blocked' : 'cancelled';
}

function reasonFor(confirmation) {
  return [
    confirmation.nativeConfirmation && confirmation.nativeConfirmation.reason,
    confirmation.execution && confirmation.execution.reason,
  ].filter(Boolean).join(' ');
}

function buildRuntimeActionNativeConfirmationAuditEvent(confirmationInput) {
  const confirmation = assertNonExecutingConfirmation(confirmationInput);
  const redactedFields = [];
  const rawReason = reasonFor(confirmation);
  const rawPayloadSummary = `${confirmation.runtimeId}:${confirmation.actionKind}:${confirmation.status}`;
  const reason = rawReason ? '[redacted]' : undefined;
  if (rawReason) redactedFields.push('reason');
  redactedFields.push('payloadSummary');

  return {
    schemaVersion: 1,
    eventType: eventTypeForStatus(confirmation.status),
    occurredAt: confirmation.confirmedAt || new Date().toISOString(),
    correlationId: confirmation.correlationId || 'invalid',
    runtimeId: redactText(confirmation.runtimeId || 'unknown'),
    actionKind: redactText(confirmation.actionKind || 'unknown'),
    source: redactText(confirmation.source || 'renderer'),
    submitState: 'pending_approval',
    desktopApi: null,
    outcome: confirmation.status,
    ...(reason ? { reason } : {}),
    payloadSummary: rawPayloadSummary ? '[redacted]' : null,
    resultStatus: resultStatusForStatus(confirmation.status),
    resultMessage: redactText(confirmation.message || 'Native confirmation recorded. No action executed.'),
    safeForLog: true,
    redactedFields: [...new Set(redactedFields)],
  };
}

module.exports = {
  buildRuntimeActionNativeConfirmationAuditEvent,
};
