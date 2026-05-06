import { ALLOWLISTED_RUNTIME_ACTION_APIS, type AllowlistedRuntimeActionApi } from './runtimeActionAllowlist';

export type RuntimeActionAllowlistedHandlerStatus = 'planned_not_implemented';

export type RuntimeActionAllowlistedHandlerContract = {
  desktopApi: AllowlistedRuntimeActionApi;
  status: RuntimeActionAllowlistedHandlerStatus;
  owner: 'electron_main';
  executable: false;
  rendererCanInvoke: false;
  requiresApprovalDecision: true;
  requiresNativeConfirmation: true;
  requiresSeparateImplementationApproval: true;
  reason: string;
};

export type RuntimeActionAllowlistedHandlerRegistryContract = {
  schemaVersion: 1;
  owner: 'electron_main';
  state: 'model_only';
  registryImplemented: false;
  handlersExecutable: false;
  rendererCanRegisterHandlers: false;
  rendererCanExecuteHandlers: false;
  ipc: {
    registerChannel: null;
    executeChannel: null;
  };
  handlers: RuntimeActionAllowlistedHandlerContract[];
  guardrails: string[];
};

export type RuntimeActionHandlerReadinessReport = {
  schemaVersion: 1;
  readyForExecution: false;
  implementedHandlerCount: number;
  executableHandlerCount: number;
  totalAllowlistedHandlerCount: number;
  message: string;
};

export type RuntimeActionHandlerRegistryValidation =
  | { valid: true; reason: string }
  | { valid: false; reason: string };

const HANDLER_REGISTRY_GUARDRAILS = [
  'This contract registers no executable handlers.',
  'Renderer cannot register or execute runtime action handlers.',
  'Electron main ownership is documented, but no handler dispatch exists.',
  'Every real handler requires separate implementation approval, tests, native confirmation, and audit coverage.',
];

function plannedHandler(desktopApi: AllowlistedRuntimeActionApi): RuntimeActionAllowlistedHandlerContract {
  return {
    desktopApi,
    status: 'planned_not_implemented',
    owner: 'electron_main',
    executable: false,
    rendererCanInvoke: false,
    requiresApprovalDecision: true,
    requiresNativeConfirmation: true,
    requiresSeparateImplementationApproval: true,
    reason: 'This allowlisted desktop API is named for future planning only. No Electron-main handler is implemented.',
  };
}

export function buildRuntimeActionAllowlistedHandlerRegistryContract(): RuntimeActionAllowlistedHandlerRegistryContract {
  return {
    schemaVersion: 1,
    owner: 'electron_main',
    state: 'model_only',
    registryImplemented: false,
    handlersExecutable: false,
    rendererCanRegisterHandlers: false,
    rendererCanExecuteHandlers: false,
    ipc: {
      registerChannel: null,
      executeChannel: null,
    },
    handlers: ALLOWLISTED_RUNTIME_ACTION_APIS.map(plannedHandler),
    guardrails: HANDLER_REGISTRY_GUARDRAILS,
  };
}

export function buildRuntimeActionHandlerReadinessReport(
  contract: RuntimeActionAllowlistedHandlerRegistryContract,
): RuntimeActionHandlerReadinessReport {
  return {
    schemaVersion: 1,
    readyForExecution: false,
    implementedHandlerCount: contract.handlers.filter((handler) => handler.status !== 'planned_not_implemented').length,
    executableHandlerCount: contract.handlers.filter((handler) => handler.executable).length,
    totalAllowlistedHandlerCount: contract.handlers.length,
    message: 'No allowlisted runtime action handlers are implemented. Execution remains unavailable until a separately approved implementation slice.',
  };
}

export function validateRuntimeActionHandlerRegistryContract(
  contract: RuntimeActionAllowlistedHandlerRegistryContract,
): RuntimeActionHandlerRegistryValidation {
  if (contract.state !== 'model_only' || contract.registryImplemented || contract.handlersExecutable) {
    return { valid: false, reason: 'Handler registry must stay model-only with no implemented executable handlers.' };
  }
  if (contract.rendererCanRegisterHandlers || contract.rendererCanExecuteHandlers) {
    return { valid: false, reason: 'Renderer cannot register or execute runtime action handlers.' };
  }
  if (contract.ipc.registerChannel !== null || contract.ipc.executeChannel !== null) {
    return { valid: false, reason: 'Handler registry contract must not expose IPC channels.' };
  }
  if (contract.handlers.some((handler) => handler.executable || handler.status !== 'planned_not_implemented' || !handler.requiresSeparateImplementationApproval)) {
    return { valid: false, reason: 'All allowlisted handler entries must remain planned, non-executable, and separately approval-gated.' };
  }
  return { valid: true, reason: 'Handler registry contract is model-only and non-executable.' };
}
