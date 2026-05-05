import type { RuntimeActionMetadata } from './runtimeReadiness';

export type RuntimeActionApprovalMode =
  | 'no_approval_required'
  | 'future_approval_required'
  | 'blocked_until_desktop_allowlisted';

export type RuntimeActionExecutionCapability = 'metadata_only' | 'requires_allowlisted_desktop_api';

export type RuntimeActionApprovalPolicy = {
  mode: RuntimeActionApprovalMode;
  executionCapability: RuntimeActionExecutionCapability;
  canExecuteNow: false;
  approvalRequiredBeforeExecution: boolean;
  userFacingSummary: string;
  guardrails: string[];
};

const BASE_GUARDRAILS = [
  'Renderer must not execute arbitrary shell commands.',
  'No command runs from this preview/preflight action.',
];

export function buildRuntimeActionApproval(action: RuntimeActionMetadata): RuntimeActionApprovalPolicy {
  if (action.kind === 'requires_desktop') {
    return {
      mode: 'blocked_until_desktop_allowlisted',
      executionCapability: 'requires_allowlisted_desktop_api',
      canExecuteNow: false,
      approvalRequiredBeforeExecution: action.preflight.requiresApproval,
      userFacingSummary:
        'Desktop bridge required. This cannot execute unless Conductor adds an explicit allowlisted Electron API and approval flow.',
      guardrails: [
        ...BASE_GUARDRAILS,
        'Execution requires an explicit allowlisted Electron main-process API.',
        'Browser mode must not imply executable runtime actions.',
      ],
    };
  }

  if (action.preflight.requiresApproval) {
    return {
      mode: 'future_approval_required',
      executionCapability: 'metadata_only',
      canExecuteNow: false,
      approvalRequiredBeforeExecution: true,
      userFacingSummary:
        'Runtime readiness is not blocked. Only a future Conductor-triggered action would ask for explicit approval first.',
      guardrails: BASE_GUARDRAILS,
    };
  }

  return {
    mode: 'no_approval_required',
    executionCapability: 'metadata_only',
    canExecuteNow: false,
    approvalRequiredBeforeExecution: false,
    userFacingSummary: 'No approval is required for this non-mutating action. Conductor still does not run commands from the renderer.',
    guardrails: BASE_GUARDRAILS,
  };
}
