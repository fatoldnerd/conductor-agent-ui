import type { FutureExecutableRuntimeAction, RuntimeActionExecutionContract } from './runtimeActionAllowlist';
import type { CanonicalRuntimeId, RuntimeActionKind, RuntimeActionMetadata } from './runtimeReadiness';

export type RuntimeActionRequestSource = 'agent-runtimes' | 'dashboard' | 'diagnostics' | 'installer';
export type RuntimeActionRequestSubmitState = 'not_submittable' | 'blocked' | 'pending_approval' | 'ready_for_desktop';
export type RuntimeActionRequestedBy = 'renderer';

export type RuntimeActionRequestContext = {
  runtimeId: CanonicalRuntimeId;
  source: RuntimeActionRequestSource;
  requestedBy: RuntimeActionRequestedBy;
  correlationId: string;
};

export type RuntimeActionRequestPayload = {
  runtimeId: CanonicalRuntimeId;
  actionKind: RuntimeActionKind;
};

export type RuntimeActionRequestEnvelope = {
  schemaVersion: 1;
  runtimeId: CanonicalRuntimeId;
  actionKind: RuntimeActionKind;
  source: RuntimeActionRequestSource;
  requestedBy: RuntimeActionRequestedBy;
  correlationId: string;
  submitState: RuntimeActionRequestSubmitState;
  desktopApi: RuntimeActionExecutionContract['allowlistedDesktopApi'];
  payload: RuntimeActionRequestPayload | null;
  reason: string;
  audit: {
    safeForLog: boolean;
    redactedFields: string[];
  };
};

export type RuntimeActionResultStatus = 'completed' | 'blocked' | 'failed' | 'cancelled';

export type RuntimeActionResultEnvelope = {
  schemaVersion: 1;
  correlationId: string;
  status: RuntimeActionResultStatus;
  message: string;
  detail?: string;
};

function isFutureExecutableRuntimeAction(
  action: RuntimeActionMetadata | FutureExecutableRuntimeAction,
): action is FutureExecutableRuntimeAction {
  return action.executesCommand === true;
}

function buildPayload(
  action: RuntimeActionMetadata | FutureExecutableRuntimeAction,
  context: RuntimeActionRequestContext,
): RuntimeActionRequestPayload | null {
  if (!isFutureExecutableRuntimeAction(action)) return null;
  return {
    runtimeId: context.runtimeId,
    actionKind: action.kind,
  };
}

function submitStateFor(
  action: RuntimeActionMetadata | FutureExecutableRuntimeAction,
  contract: RuntimeActionExecutionContract,
): RuntimeActionRequestSubmitState {
  if (contract.status === 'metadata_only') return 'not_submittable';
  if (contract.status === 'blocked_unallowlisted') return 'blocked';
  if (contract.requiresExplicitApproval || action.preflight.requiresApproval) return 'pending_approval';
  return 'ready_for_desktop';
}

function redactedFieldsFor(contract: RuntimeActionExecutionContract): string[] {
  if (contract.status === 'blocked_unallowlisted') return ['payload'];
  return [];
}

export function buildRuntimeActionRequestEnvelope(
  action: RuntimeActionMetadata | FutureExecutableRuntimeAction,
  contract: RuntimeActionExecutionContract,
  context: RuntimeActionRequestContext,
): RuntimeActionRequestEnvelope {
  const submitState = submitStateFor(action, contract);
  const payload = contract.status === 'desktop_api_gated' ? buildPayload(action, context) : null;

  return {
    schemaVersion: 1,
    runtimeId: context.runtimeId,
    actionKind: action.kind,
    source: context.source,
    requestedBy: context.requestedBy,
    correlationId: context.correlationId,
    submitState,
    desktopApi: contract.allowlistedDesktopApi,
    payload,
    reason: contract.reason,
    audit: {
      safeForLog: true,
      redactedFields: redactedFieldsFor(contract),
    },
  };
}

export function buildRuntimeActionResultEnvelope(input: {
  correlationId: string;
  status: RuntimeActionResultStatus;
  message: string;
  detail?: string;
}): RuntimeActionResultEnvelope {
  return {
    schemaVersion: 1,
    correlationId: input.correlationId,
    status: input.status,
    message: input.message,
    ...(input.detail ? { detail: input.detail } : {}),
  };
}
