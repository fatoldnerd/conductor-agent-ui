import type { RuntimeActionMetadata } from './runtimeReadiness';

export const ALLOWLISTED_RUNTIME_ACTION_APIS = [
  'runtime.refreshInventory',
  'runtime.runHealthCheck',
  'runtime.openDocumentation',
  'runtime.previewInstallerRecipe',
  'runtime.openConfigurationGuide',
] as const;

export type AllowlistedRuntimeActionApi = (typeof ALLOWLISTED_RUNTIME_ACTION_APIS)[number];

export type FutureExecutableRuntimeAction = Omit<RuntimeActionMetadata, 'executesCommand'> & {
  executesCommand: boolean;
  allowlistedDesktopApi: string | null;
};

export type RuntimeActionExecutionContractStatus = 'metadata_only' | 'blocked_unallowlisted' | 'desktop_api_gated';

export type RuntimeActionExecutionContract = {
  status: RuntimeActionExecutionContractStatus;
  canExecuteFromRenderer: false;
  allowlistedDesktopApi: AllowlistedRuntimeActionApi | null;
  requiresExplicitApproval: boolean;
  reason: string;
  guardrails: string[];
};

const METADATA_ONLY_GUARDRAILS = [
  'Renderer cannot execute shell commands.',
  'Metadata-only actions may show previews, requirements, and expected effects only.',
];

const DESKTOP_API_GUARDRAILS = [
  'Renderer cannot execute shell commands.',
  'Execution, if implemented later, must be routed through Electron main/preload.',
  'Renderer receives an action request contract, never a shell command.',
];

function hasFutureExecutableShape(action: RuntimeActionMetadata | FutureExecutableRuntimeAction): action is FutureExecutableRuntimeAction {
  return action.executesCommand === true;
}

export function isAllowlistedRuntimeActionApi(api: string | null | undefined): api is AllowlistedRuntimeActionApi {
  return Boolean(api && (ALLOWLISTED_RUNTIME_ACTION_APIS as readonly string[]).includes(api));
}

export function buildRuntimeActionExecutionContract(
  action: RuntimeActionMetadata | FutureExecutableRuntimeAction,
): RuntimeActionExecutionContract {
  if (!hasFutureExecutableShape(action)) {
    return {
      status: 'metadata_only',
      canExecuteFromRenderer: false,
      allowlistedDesktopApi: null,
      requiresExplicitApproval: action.preflight.requiresApproval,
      reason: 'This action is metadata-only. It may be displayed as preview/preflight guidance, but it cannot execute.',
      guardrails: METADATA_ONLY_GUARDRAILS,
    };
  }

  if (!action.allowlistedDesktopApi) {
    return {
      status: 'blocked_unallowlisted',
      canExecuteFromRenderer: false,
      allowlistedDesktopApi: null,
      requiresExplicitApproval: true,
      reason: 'No allowlisted Electron API was named for this executable action.',
      guardrails: DESKTOP_API_GUARDRAILS,
    };
  }

  if (!isAllowlistedRuntimeActionApi(action.allowlistedDesktopApi)) {
    return {
      status: 'blocked_unallowlisted',
      canExecuteFromRenderer: false,
      allowlistedDesktopApi: null,
      requiresExplicitApproval: true,
      reason: `Desktop API "${action.allowlistedDesktopApi}" is not in the runtime action allowlist.`,
      guardrails: DESKTOP_API_GUARDRAILS,
    };
  }

  return {
    status: 'desktop_api_gated',
    canExecuteFromRenderer: false,
    allowlistedDesktopApi: action.allowlistedDesktopApi,
    requiresExplicitApproval: action.preflight.requiresApproval,
    reason: 'This future executable action is gated behind an allowlisted Electron API contract.',
    guardrails: DESKTOP_API_GUARDRAILS,
  };
}
