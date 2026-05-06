const {
  readRuntimeActionApprovalQueue,
  setRuntimeActionApprovalQueuePath,
} = require('./runtimeActionApprovalQueueStore.cjs');
const {
  appendRuntimeActionApprovalDecisionEnvelopes,
  readRuntimeActionApprovalDecisions,
  setRuntimeActionApprovalDecisionPath,
} = require('./runtimeActionApprovalDecisionStore.cjs');

const VALID_DECISIONS = new Set(['approved', 'rejected', 'cancelled']);
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

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Approval decision payload must be an object');
  }
  if (typeof payload.correlationId !== 'string' || !CORRELATION_ID_PATTERN.test(payload.correlationId)) {
    throw new Error('Invalid runtime action correlation id');
  }
  if (typeof payload.decision !== 'string' || !VALID_DECISIONS.has(payload.decision)) {
    throw new Error('Invalid approval decision');
  }
  if (payload.note !== undefined && typeof payload.note !== 'string') {
    throw new Error('Approval decision note must be a string when provided');
  }
  if (payload.decidedAt !== undefined && typeof payload.decidedAt !== 'string') {
    throw new Error('Approval decision timestamp must be a string when provided');
  }
  return {
    correlationId: payload.correlationId,
    decision: payload.decision,
    decidedAt: payload.decidedAt || new Date().toISOString(),
    note: payload.note ? redactText(payload.note) : undefined,
  };
}

function findPendingQueueItem(correlationId) {
  const queue = readRuntimeActionApprovalQueue();
  if (queue.status === 'unavailable') throw new Error('Runtime action approval queue is unavailable');
  const item = queue.items.find((entry) => entry.correlationId === correlationId);
  if (!item || item.state !== 'awaiting_approval' || !item.canApprove || !item.canReject) {
    throw new Error(`No pending approval queue item found for ${correlationId}`);
  }
  return item;
}

function assertNoExistingDecision(correlationId) {
  const decisions = readRuntimeActionApprovalDecisions();
  if (decisions.status === 'unavailable') throw new Error('Runtime action approval decision store is unavailable');
  if (decisions.decisions.some((decision) => decision.correlationId === correlationId)) {
    throw new Error(`Runtime action ${correlationId} already has a recorded decision`);
  }
}

function buildDecision(input) {
  return {
    schemaVersion: 1,
    decision: input.decision,
    decidedAt: input.decidedAt,
    decidedBy: 'user',
    ...(input.note ? { note: redactText(input.note) } : {}),
    safeForLog: true,
  };
}

function decisionEventFor(item, decision) {
  return {
    schemaVersion: 1,
    eventType: decision.decision === 'approved' ? 'approved' : 'cancelled',
    occurredAt: decision.decidedAt,
    correlationId: item.correlationId,
    runtimeId: item.runtimeId,
    actionKind: item.actionKind,
    source: item.source,
    payloadSummary: `${item.actionKind} ${decision.decision}`,
    reason: redactText(decision.note || `${decision.decision} by user`),
    safeForLog: true,
    redactedFields: [],
  };
}

function envelopeState(decision) {
  if (decision === 'approved') return 'accepted_for_native_confirmation';
  if (decision === 'rejected') return 'rejected';
  return 'cancelled';
}

function buildDecisionEnvelope(item, decision) {
  const approved = decision.decision === 'approved';
  return {
    schemaVersion: 1,
    state: envelopeState(decision.decision),
    correlationId: item.correlationId,
    runtimeId: item.runtimeId,
    actionKind: item.actionKind,
    source: item.source,
    decision,
    execution: {
      rendererCanExecute: false,
      requiresNativeConfirmation: approved,
      desktopApi: approved ? item.desktopApi : null,
      reason: approved
        ? 'Approved decisions require native desktop confirmation before any execution can begin.'
        : 'Rejected or cancelled decisions are terminal and cannot execute.',
    },
    auditEvents: [
      ...(Array.isArray(item.auditPreview) && item.auditPreview[0] ? [item.auditPreview[0]] : []),
      decisionEventFor(item, decision),
    ],
  };
}

function resultForEnvelope(envelope) {
  return {
    schemaVersion: 1,
    status: envelope.state,
    correlationId: envelope.correlationId,
    decision: envelope.decision,
    execution: envelope.execution,
    nativeConfirmation: {
      required: envelope.execution.requiresNativeConfirmation,
      implemented: false,
      reason: envelope.execution.requiresNativeConfirmation
        ? 'Native confirmation is required but not implemented in this submit bridge slice.'
        : 'Rejected or cancelled decisions do not require native confirmation.',
    },
    message: envelope.state === 'accepted_for_native_confirmation'
      ? 'Approval decision recorded. The action still cannot execute until a future native confirmation and execution handler exist.'
      : 'Approval decision recorded as terminal. The action cannot execute.',
  };
}

function submitRuntimeActionApprovalDecision(payload) {
  const safePayload = validatePayload(payload);
  const item = findPendingQueueItem(safePayload.correlationId);
  assertNoExistingDecision(safePayload.correlationId);
  const decision = buildDecision(safePayload);
  const envelope = buildDecisionEnvelope(item, decision);
  appendRuntimeActionApprovalDecisionEnvelopes([envelope]);
  return resultForEnvelope(envelope);
}

function setRuntimeActionApprovalDecisionSubmitterPaths(input) {
  if (!input || typeof input !== 'object') throw new Error('Submitter path configuration must be an object');
  if (input.queuePath) setRuntimeActionApprovalQueuePath(input.queuePath);
  if (input.decisionPath) setRuntimeActionApprovalDecisionPath(input.decisionPath);
}

module.exports = {
  setRuntimeActionApprovalDecisionSubmitterPaths,
  submitRuntimeActionApprovalDecision,
};
