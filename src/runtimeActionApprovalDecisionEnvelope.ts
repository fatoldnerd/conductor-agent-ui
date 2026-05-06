import type { RuntimeActionAuditEvent } from './runtimeActionAuditLog';
import {
  applyRuntimeActionApprovalDecision,
  buildRuntimeActionApprovalDecision,
  type RuntimeActionApprovalDecision,
  type RuntimeActionApprovalQueueItem,
} from './runtimeActionApprovalWorkflow';
import type { AllowlistedRuntimeActionApi } from './runtimeActionAllowlist';

export type RuntimeActionDecisionEnvelopeState = 'invalid' | 'accepted_for_native_confirmation' | 'rejected' | 'cancelled';

export type RuntimeActionApprovalDecisionEnvelope = {
  schemaVersion: 1;
  state: RuntimeActionDecisionEnvelopeState;
  correlationId: string;
  runtimeId: RuntimeActionApprovalQueueItem['runtimeId'];
  actionKind: RuntimeActionApprovalQueueItem['actionKind'];
  source: RuntimeActionApprovalQueueItem['source'];
  decision: RuntimeActionApprovalDecision;
  execution: {
    rendererCanExecute: false;
    requiresNativeConfirmation: boolean;
    desktopApi: AllowlistedRuntimeActionApi | null;
    reason: string;
  };
  auditEvents: RuntimeActionAuditEvent[];
};

export type RuntimeActionDecisionEnvelopeValidation =
  | {
      valid: true;
      reason: string;
    }
  | {
      valid: false;
      reason: string;
    };

const SENSITIVE_TEXT_PATTERNS = [
  /\b(token|secret|api[_-]?key|password)\s*=\s*[^\s,;]+/gi,
  /\/Users\/[^\s,;]+/g,
  /\/home\/[^\s,;]+/g,
  /\/root\/[^\s,;]+/g,
];

function redactText(value: string): string {
  return SENSITIVE_TEXT_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), value);
}

function sanitizeDecision(decision: RuntimeActionApprovalDecision): RuntimeActionApprovalDecision {
  return buildRuntimeActionApprovalDecision({
    decision: decision.decision,
    decidedAt: decision.decidedAt,
    decidedBy: decision.decidedBy,
    ...(decision.note ? { note: redactText(decision.note) } : {}),
  });
}

function stateFor(decision: RuntimeActionApprovalDecision): RuntimeActionDecisionEnvelopeState {
  if (decision.decision === 'approved') return 'accepted_for_native_confirmation';
  if (decision.decision === 'rejected') return 'rejected';
  return 'cancelled';
}

export function buildRuntimeActionDecisionEnvelope(input: {
  item: RuntimeActionApprovalQueueItem;
  decision: RuntimeActionApprovalDecision;
}): RuntimeActionApprovalDecisionEnvelope {
  const decision = sanitizeDecision(input.decision);
  const invalidBase = {
    schemaVersion: 1 as const,
    state: 'invalid' as const,
    correlationId: input.item.correlationId,
    runtimeId: input.item.runtimeId,
    actionKind: input.item.actionKind,
    source: input.item.source,
    decision,
    execution: {
      rendererCanExecute: false as const,
      requiresNativeConfirmation: false,
      desktopApi: null,
      reason: 'Approval decisions are only valid for pending approval queue items.',
    },
    auditEvents: [],
  };

  if (input.item.state !== 'awaiting_approval' || !input.item.canApprove || !input.item.canReject) {
    return invalidBase;
  }

  const decidedItem = applyRuntimeActionApprovalDecision(input.item, decision);
  const approved = decision.decision === 'approved';

  return {
    schemaVersion: 1,
    state: stateFor(decision),
    correlationId: input.item.correlationId,
    runtimeId: input.item.runtimeId,
    actionKind: input.item.actionKind,
    source: input.item.source,
    decision,
    execution: {
      rendererCanExecute: false,
      requiresNativeConfirmation: approved,
      desktopApi: approved ? input.item.desktopApi : null,
      reason: approved
        ? 'Approved decisions require native desktop confirmation before any execution can begin.'
        : 'Rejected or cancelled decisions are terminal and cannot execute.',
    },
    auditEvents: decidedItem.auditPreview,
  };
}

export function validateRuntimeActionDecisionEnvelopeForSubmit(
  envelope: RuntimeActionApprovalDecisionEnvelope,
): RuntimeActionDecisionEnvelopeValidation {
  if (envelope.state !== 'accepted_for_native_confirmation' || envelope.decision.decision !== 'approved') {
    return { valid: false, reason: 'Only approved decision envelopes can continue to native confirmation.' };
  }
  if (envelope.execution.rendererCanExecute || !envelope.execution.requiresNativeConfirmation || !envelope.execution.desktopApi) {
    return { valid: false, reason: 'Approved decision envelope is missing required native-confirmation safeguards.' };
  }
  return {
    valid: true,
    reason: 'Approved decisions require native desktop confirmation before any execution can begin.',
  };
}
