import type {
  RuntimeActionRequestEnvelope,
  RuntimeActionRequestSource,
  RuntimeActionRequestSubmitState,
  RuntimeActionResultEnvelope,
  RuntimeActionResultStatus,
} from './runtimeActionRequestEnvelope';
import type { AllowlistedRuntimeActionApi } from './runtimeActionAllowlist';
import type { CanonicalRuntimeId, RuntimeActionKind } from './runtimeReadiness';

export type RuntimeActionAuditEventType =
  | 'request_created'
  | 'approval_required'
  | 'approved'
  | 'blocked'
  | 'submitted_to_desktop'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RuntimeActionAuditOutcome = 'recorded' | 'approval_required' | 'approved' | 'blocked' | RuntimeActionResultStatus;

export type RuntimeActionAuditEvent = {
  schemaVersion: 1;
  eventType: RuntimeActionAuditEventType;
  occurredAt: string;
  correlationId: string;
  runtimeId: CanonicalRuntimeId;
  actionKind: RuntimeActionKind;
  source: RuntimeActionRequestSource;
  submitState: RuntimeActionRequestSubmitState;
  desktopApi: AllowlistedRuntimeActionApi | null;
  outcome: RuntimeActionAuditOutcome;
  reason?: string;
  payloadSummary: string | null;
  resultStatus?: RuntimeActionResultStatus;
  resultMessage?: string;
  safeForLog: boolean;
  redactedFields: string[];
};

const UNSAFE_MARKERS = [
  'command',
  'stderr',
  'token',
  '/Users/',
  '/home/',
  'bash -lc',
  'secret',
];

function outcomeFor(eventType: RuntimeActionAuditEventType, result?: RuntimeActionResultEnvelope): RuntimeActionAuditOutcome {
  if (result) return result.status;
  if (eventType === 'blocked') return 'blocked';
  if (eventType === 'approval_required') return 'approval_required';
  if (eventType === 'approved') return 'approved';
  return 'recorded';
}

function payloadSummaryFor(envelope: RuntimeActionRequestEnvelope): string | null {
  if (!envelope.payload) return null;
  return `${envelope.payload.runtimeId}:${envelope.payload.actionKind}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function containsUnsafeMarker(value: string | undefined | null): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return UNSAFE_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

export function buildRuntimeActionAuditEvent(input: {
  envelope: RuntimeActionRequestEnvelope;
  eventType: RuntimeActionAuditEventType;
  occurredAt: string;
  result?: RuntimeActionResultEnvelope;
}): RuntimeActionAuditEvent {
  const { envelope, eventType, occurredAt, result } = input;
  return redactRuntimeActionAuditEvent({
    schemaVersion: 1,
    eventType,
    occurredAt,
    correlationId: envelope.correlationId,
    runtimeId: envelope.runtimeId,
    actionKind: envelope.actionKind,
    source: envelope.source,
    submitState: envelope.submitState,
    desktopApi: envelope.desktopApi,
    outcome: outcomeFor(eventType, result),
    reason: envelope.reason,
    payloadSummary: payloadSummaryFor(envelope),
    ...(result ? { resultStatus: result.status, resultMessage: result.message } : {}),
    safeForLog: envelope.audit.safeForLog,
    redactedFields: envelope.audit.redactedFields,
  });
}

export function buildRuntimeActionAuditTimeline(input: {
  envelope: RuntimeActionRequestEnvelope;
  requestedAt: string;
  approvedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  result?: RuntimeActionResultEnvelope;
}): RuntimeActionAuditEvent[] {
  const events: RuntimeActionAuditEvent[] = [
    buildRuntimeActionAuditEvent({
      envelope: input.envelope,
      eventType: 'request_created',
      occurredAt: input.requestedAt,
    }),
  ];

  if (input.envelope.submitState === 'pending_approval' && !input.approvedAt) {
    events.push(buildRuntimeActionAuditEvent({
      envelope: input.envelope,
      eventType: 'approval_required',
      occurredAt: input.requestedAt,
    }));
  }

  if (input.approvedAt) {
    events.push(buildRuntimeActionAuditEvent({
      envelope: input.envelope,
      eventType: 'approved',
      occurredAt: input.approvedAt,
    }));
  }

  if (input.submittedAt) {
    events.push(buildRuntimeActionAuditEvent({
      envelope: input.envelope,
      eventType: 'submitted_to_desktop',
      occurredAt: input.submittedAt,
    }));
  }

  if (input.completedAt && input.result) {
    events.push(buildRuntimeActionAuditEvent({
      envelope: input.envelope,
      eventType: input.result.status,
      occurredAt: input.completedAt,
      result: input.result,
    }));
  }

  return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export function redactRuntimeActionAuditEvent(event: RuntimeActionAuditEvent): RuntimeActionAuditEvent {
  const redactedFields = [...event.redactedFields];
  let next: RuntimeActionAuditEvent = { ...event };

  if (!event.safeForLog || containsUnsafeMarker(event.reason)) {
    if (event.reason) {
      next = { ...next, reason: '[redacted]' };
      redactedFields.push('reason');
    }
  }

  if (!event.safeForLog || containsUnsafeMarker(event.payloadSummary)) {
    if (event.payloadSummary) {
      next = { ...next, payloadSummary: '[redacted]' };
      redactedFields.push('payloadSummary');
    }
  }

  if (!event.safeForLog || containsUnsafeMarker(event.resultMessage)) {
    if (event.resultMessage) {
      next = { ...next, resultMessage: '[redacted]' };
      redactedFields.push('resultMessage');
    }
  }

  return {
    ...next,
    safeForLog: true,
    redactedFields: unique(redactedFields),
  };
}
