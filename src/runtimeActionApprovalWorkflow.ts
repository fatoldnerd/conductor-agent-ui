import { buildRuntimeActionAuditEvent, type RuntimeActionAuditEvent } from './runtimeActionAuditLog';
import type { RuntimeActionRequestEnvelope } from './runtimeActionRequestEnvelope';
import { CANONICAL_RUNTIME_LABELS, type RuntimeActionRiskLevel } from './runtimeReadiness';

export type RuntimeActionApprovalQueueState =
  | 'not_queueable'
  | 'blocked'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type RuntimeActionApprovalDecisionValue = 'approved' | 'rejected' | 'cancelled';
export type RuntimeActionApprovalDecisionActor = 'user' | 'system';

export type RuntimeActionApprovalDecision = {
  schemaVersion: 1;
  decision: RuntimeActionApprovalDecisionValue;
  decidedAt: string;
  decidedBy: RuntimeActionApprovalDecisionActor;
  note?: string;
  safeForLog: true;
};

export type RuntimeActionApprovalQueueItem = {
  schemaVersion: 1;
  state: RuntimeActionApprovalQueueState;
  correlationId: string;
  runtimeId: RuntimeActionRequestEnvelope['runtimeId'];
  actionKind: RuntimeActionRequestEnvelope['actionKind'];
  source: RuntimeActionRequestEnvelope['source'];
  desktopApi: RuntimeActionRequestEnvelope['desktopApi'];
  riskLevel: RuntimeActionRiskLevel;
  requestedAt: string;
  requestedSummary: string;
  approvalPrompt: string;
  canApprove: boolean;
  canReject: boolean;
  requiresNativeConfirmation: boolean;
  guardrails: string[];
  auditPreview: RuntimeActionAuditEvent[];
  decision?: RuntimeActionApprovalDecision;
};

const APPROVAL_GUARDRAILS = [
  'Approval only unlocks a named desktop API; it never unlocks renderer shell execution.',
  'A native desktop confirmation is still required before any future execution.',
  'Every approval decision must be represented in the audit trail.',
];

function sourceLabel(source: RuntimeActionRequestEnvelope['source']): string {
  if (source === 'agent-runtimes') return 'Agent Runtimes';
  if (source === 'dashboard') return 'Dashboard';
  if (source === 'diagnostics') return 'Diagnostics';
  return 'Installer';
}

function actionLabel(actionKind: RuntimeActionRequestEnvelope['actionKind']): string {
  return actionKind.replace(/_/g, ' ');
}

function riskLevelFor(envelope: RuntimeActionRequestEnvelope): RuntimeActionRiskLevel {
  if (envelope.submitState === 'blocked') return 'high';
  if (envelope.actionKind === 'preview_install' || envelope.actionKind === 'configure') return 'medium';
  if (envelope.actionKind === 'health_check' || envelope.actionKind === 'copy_install_command') return 'low';
  return 'none';
}

function stateFor(envelope: RuntimeActionRequestEnvelope): RuntimeActionApprovalQueueState {
  if (envelope.submitState === 'pending_approval') return 'awaiting_approval';
  if (envelope.submitState === 'blocked') return 'blocked';
  return 'not_queueable';
}

function approvalPromptFor(envelope: RuntimeActionRequestEnvelope, state: RuntimeActionApprovalQueueState): string {
  const runtimeLabel = CANONICAL_RUNTIME_LABELS[envelope.runtimeId];
  const action = actionLabel(envelope.actionKind);

  if (state === 'awaiting_approval') {
    return `Approve ${action} for ${runtimeLabel}? Conductor will still require native desktop confirmation before any future execution.`;
  }
  if (state === 'blocked') {
    return `This ${action} request is blocked before approval because it is not tied to an allowlisted desktop API.`;
  }
  return 'No approval request is queued because this action is preview metadata only.';
}

function auditPreviewFor(envelope: RuntimeActionRequestEnvelope, state: RuntimeActionApprovalQueueState, at: string): RuntimeActionAuditEvent[] {
  const events = [
    buildRuntimeActionAuditEvent({
      envelope,
      eventType: 'request_created',
      occurredAt: at,
    }),
  ];

  if (state === 'awaiting_approval') {
    events.push(buildRuntimeActionAuditEvent({ envelope, eventType: 'approval_required', occurredAt: at }));
  }
  if (state === 'blocked') {
    events.push(buildRuntimeActionAuditEvent({ envelope, eventType: 'blocked', occurredAt: at }));
  }

  return events;
}

export function buildRuntimeActionApprovalQueueItem(input: {
  envelope: RuntimeActionRequestEnvelope;
  requestedAt: string;
}): RuntimeActionApprovalQueueItem {
  const { envelope, requestedAt } = input;
  const state = stateFor(envelope);
  const canDecide = state === 'awaiting_approval';
  const runtimeLabel = CANONICAL_RUNTIME_LABELS[envelope.runtimeId];
  const action = actionLabel(envelope.actionKind);

  return {
    schemaVersion: 1,
    state,
    correlationId: envelope.correlationId,
    runtimeId: envelope.runtimeId,
    actionKind: envelope.actionKind,
    source: envelope.source,
    desktopApi: envelope.desktopApi,
    riskLevel: riskLevelFor(envelope),
    requestedAt,
    requestedSummary: `${runtimeLabel} requested ${action} from ${sourceLabel(envelope.source)}.`,
    approvalPrompt: approvalPromptFor(envelope, state),
    canApprove: canDecide,
    canReject: canDecide,
    requiresNativeConfirmation: canDecide,
    guardrails: APPROVAL_GUARDRAILS,
    auditPreview: auditPreviewFor(envelope, state, requestedAt),
  };
}

export function buildRuntimeActionApprovalDecision(input: {
  decision: RuntimeActionApprovalDecisionValue;
  decidedAt: string;
  decidedBy: RuntimeActionApprovalDecisionActor;
  note?: string;
}): RuntimeActionApprovalDecision {
  return {
    schemaVersion: 1,
    decision: input.decision,
    decidedAt: input.decidedAt,
    decidedBy: input.decidedBy,
    ...(input.note ? { note: input.note } : {}),
    safeForLog: true,
  };
}

function eventTypeForDecision(decision: RuntimeActionApprovalDecision): 'approved' | 'cancelled' {
  if (decision.decision === 'approved') return 'approved';
  return 'cancelled';
}

function stateForDecision(decision: RuntimeActionApprovalDecision): RuntimeActionApprovalQueueState {
  if (decision.decision === 'approved') return 'approved';
  if (decision.decision === 'rejected') return 'rejected';
  return 'cancelled';
}

export function applyRuntimeActionApprovalDecision(
  item: RuntimeActionApprovalQueueItem,
  decision: RuntimeActionApprovalDecision,
): RuntimeActionApprovalQueueItem {
  if (item.state !== 'awaiting_approval') return item;

  const decisionEvent = buildRuntimeActionAuditEvent({
    envelope: {
      schemaVersion: 1,
      runtimeId: item.runtimeId,
      actionKind: item.actionKind,
      source: item.source,
      requestedBy: 'renderer',
      correlationId: item.correlationId,
      submitState: 'pending_approval',
      desktopApi: item.desktopApi,
      payload: item.desktopApi ? { runtimeId: item.runtimeId, actionKind: item.actionKind } : null,
      reason: decision.note ?? `${decision.decision} by ${decision.decidedBy}`,
      audit: { safeForLog: decision.safeForLog, redactedFields: [] },
    },
    eventType: eventTypeForDecision(decision),
    occurredAt: decision.decidedAt,
  });

  return {
    ...item,
    state: stateForDecision(decision),
    canApprove: false,
    canReject: false,
    decision,
    auditPreview: [item.auditPreview[0], decisionEvent],
  };
}
