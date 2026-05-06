import { isAllowlistedRuntimeActionApi, type AllowlistedRuntimeActionApi } from './runtimeActionAllowlist';

export type RuntimeActionExecutionPlanningContract = {
  schemaVersion: 1;
  owner: 'electron_main';
  state: 'model_only';
  rendererAccess: {
    canReadPreview: true;
    canPlan: false;
    canExecute: false;
    reason: string;
  };
  preloadApi: {
    previewMethod: 'runtimeActions.getExecutionPlanPreview';
    planMethod: null;
    executeMethod: null;
  };
  execution: {
    implemented: false;
    allowlistedHandlersImplemented: false;
    requiresApprovalDecision: true;
    requiresNativeConfirmation: true;
    requiresSeparateImplementationApproval: true;
  };
  guardrails: string[];
};

export type RuntimeActionExecutionPlanPreviewState = 'planning_preview_only' | 'blocked';

export type RuntimeActionExecutionPlanPreview = {
  schemaVersion: 1;
  state: RuntimeActionExecutionPlanPreviewState;
  owner: 'electron_main';
  correlationId: string;
  runtimeId: string;
  actionKind: string;
  source: string;
  desktopApi: AllowlistedRuntimeActionApi | null;
  rendererCanExecute: false;
  executionImplemented: false;
  wouldExecute: false;
  requiresSeparateImplementationApproval: true;
  summary: string;
  reason: string;
  guardrails: string[];
};

export type RuntimeActionExecutionPlanPreviewValidation =
  | { valid: true; reason: string }
  | { valid: false; reason: string };

type NativeConfirmationLike = {
  schemaVersion?: unknown;
  status?: unknown;
  correlationId?: unknown;
  runtimeId?: unknown;
  actionKind?: unknown;
  source?: unknown;
  nativeConfirmation?: {
    shown?: unknown;
    confirmed?: unknown;
    reason?: unknown;
  };
  execution?: {
    rendererCanExecute?: unknown;
    executed?: unknown;
    reason?: unknown;
  };
  message?: unknown;
};

const SENSITIVE_TEXT_PATTERNS = [
  /\b(token|secret|api[_-]?key|password)\s*=\s*[^\s,;]+/gi,
  /\/Users\/[^\s,;]+/g,
  /\/home\/[^\s,;]+/g,
  /\/root\/[^\s,;]+/g,
  /\b(command|stderr|bash\s+-lc)\b/gi,
];

const EXECUTION_PLAN_GUARDRAILS = [
  'No runtime action execution handler exists in this contract.',
  'Renderer cannot plan, submit, or execute runtime actions from this model.',
  'Future execution requires a separately approved Electron-main allowlisted handler implementation.',
  'A confirmed native dialog is still not execution.',
];

function redactText(value: unknown): string {
  return SENSITIVE_TEXT_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), String(value ?? ''));
}

function basePreview(input: { confirmation: NativeConfirmationLike; desktopApi: string | null; state: RuntimeActionExecutionPlanPreviewState; reason: string }): RuntimeActionExecutionPlanPreview {
  const allowlistedDesktopApi = isAllowlistedRuntimeActionApi(input.desktopApi) ? input.desktopApi : null;
  return {
    schemaVersion: 1,
    state: input.state,
    owner: 'electron_main',
    correlationId: redactText(input.confirmation.correlationId || 'invalid'),
    runtimeId: redactText(input.confirmation.runtimeId || 'unknown'),
    actionKind: redactText(input.confirmation.actionKind || 'unknown'),
    source: redactText(input.confirmation.source || 'unknown'),
    desktopApi: input.state === 'planning_preview_only' ? allowlistedDesktopApi : null,
    rendererCanExecute: false,
    executionImplemented: false,
    wouldExecute: false,
    requiresSeparateImplementationApproval: true,
    summary: input.state === 'planning_preview_only'
      ? 'This is a model-only execution plan preview. It records prerequisites for a future implementation but cannot run anything.'
      : 'Execution planning is blocked. No action can run from this preview.',
    reason: redactText(input.reason),
    guardrails: EXECUTION_PLAN_GUARDRAILS,
  };
}

export function buildRuntimeActionExecutionPlanningContract(): RuntimeActionExecutionPlanningContract {
  return {
    schemaVersion: 1,
    owner: 'electron_main',
    state: 'model_only',
    rendererAccess: {
      canReadPreview: true,
      canPlan: false,
      canExecute: false,
      reason: 'Renderer may display sanitized execution-planning previews only. It cannot create execution plans or run actions.',
    },
    preloadApi: {
      previewMethod: 'runtimeActions.getExecutionPlanPreview',
      planMethod: null,
      executeMethod: null,
    },
    execution: {
      implemented: false,
      allowlistedHandlersImplemented: false,
      requiresApprovalDecision: true,
      requiresNativeConfirmation: true,
      requiresSeparateImplementationApproval: true,
    },
    guardrails: EXECUTION_PLAN_GUARDRAILS,
  };
}

export function buildRuntimeActionExecutionPlanPreview(input: {
  confirmation: NativeConfirmationLike;
  desktopApi: string | null;
}): RuntimeActionExecutionPlanPreview {
  const { confirmation, desktopApi } = input;

  if (
    confirmation.schemaVersion !== 1
    || confirmation.status !== 'confirmed_no_execution'
    || confirmation.nativeConfirmation?.shown !== true
    || confirmation.nativeConfirmation?.confirmed !== true
  ) {
    return basePreview({
      confirmation,
      desktopApi,
      state: 'blocked',
      reason: 'Only confirmed native confirmation outcomes can produce a future execution-plan preview.',
    });
  }

  if (confirmation.execution?.rendererCanExecute !== false || confirmation.execution?.executed !== false) {
    return basePreview({
      confirmation,
      desktopApi,
      state: 'blocked',
      reason: 'Execution-plan previews require non-executing native confirmation results.',
    });
  }

  if (!isAllowlistedRuntimeActionApi(desktopApi)) {
    return basePreview({
      confirmation,
      desktopApi,
      state: 'blocked',
      reason: `Desktop API "${desktopApi ?? 'none'}" is not allowlisted for future runtime action execution planning.`,
    });
  }

  return basePreview({
    confirmation,
    desktopApi,
    state: 'planning_preview_only',
    reason: [
      'Native confirmation was recorded, but execution remains unimplemented.',
      confirmation.nativeConfirmation?.reason,
      confirmation.execution?.reason,
    ].filter(Boolean).join(' '),
  });
}

export function validateRuntimeActionExecutionPlanPreview(
  preview: RuntimeActionExecutionPlanPreview,
): RuntimeActionExecutionPlanPreviewValidation {
  if (preview.state !== 'planning_preview_only') return { valid: false, reason: 'Only planning preview states are valid for future review.' };
  if (preview.rendererCanExecute || preview.executionImplemented || preview.wouldExecute) {
    return { valid: false, reason: 'Execution plan preview must remain non-executable.' };
  }
  if (!preview.desktopApi || !isAllowlistedRuntimeActionApi(preview.desktopApi)) {
    return { valid: false, reason: 'Execution plan preview requires an allowlisted desktop API name.' };
  }
  return { valid: true, reason: 'Execution plan preview is non-executable and model-only.' };
}
