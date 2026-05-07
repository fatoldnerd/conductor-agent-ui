import { ALLOWLISTED_RUNTIME_ACTION_APIS, type AllowlistedRuntimeActionApi } from './runtimeActionAllowlist';

export type RuntimeActionAllowlistedHandlerStatus = 'implemented' | 'planned_not_implemented';

export type RuntimeActionAllowlistedHandlerContract = {
  desktopApi: AllowlistedRuntimeActionApi;
  status: RuntimeActionAllowlistedHandlerStatus;
  owner: 'electron_main';
  executable: boolean;
  rendererCanInvoke: boolean;
  acceptsRendererCommand: boolean;
  requiresShell: boolean;
  requiresApprovalDecision: boolean;
  requiresNativeConfirmation: boolean;
  requiresSeparateImplementationApproval: boolean;
  reason: string;
};

export type RuntimeActionAllowlistedHandlerRegistryContract = {
  schemaVersion: 1;
  owner: 'electron_main';
  state: 'partial_harmless_execution';
  registryImplemented: true;
  handlersExecutable: true;
  rendererCanRegisterHandlers: false;
  rendererCanExecuteArbitraryHandlers: false;
  ipc: {
    registerChannel: null;
    executeChannel: null;
    refreshInventoryChannel: 'runtimeActions:refreshInventory';
  };
  handlers: RuntimeActionAllowlistedHandlerContract[];
  guardrails: string[];
};

export type RuntimeActionHandlerReadinessReport = {
  schemaVersion: 1;
  readyForExecution: boolean;
  implementedHandlerCount: number;
  executableHandlerCount: number;
  totalAllowlistedHandlerCount: number;
  message: string;
};

export type RuntimeActionHandlerRegistryValidation =
  | { valid: true; reason: string }
  | { valid: false; reason: string };

const HANDLER_REGISTRY_GUARDRAILS = [
  'Only runtime.refreshInventory has an executable handler.',
  'Renderer cannot register handlers or invoke a generic runtime action executor.',
  'The refresh inventory handler accepts no renderer command, args, shell, path, or environment payload.',
  'All command-capable or mutating handlers remain planned and non-executable until separate implementation approval.',
];

function implementedRefreshInventoryHandler(): RuntimeActionAllowlistedHandlerContract {
  return {
    desktopApi: 'runtime.refreshInventory',
    status: 'implemented',
    owner: 'electron_main',
    executable: true,
    rendererCanInvoke: true,
    acceptsRendererCommand: false,
    requiresShell: false,
    requiresApprovalDecision: false,
    requiresNativeConfirmation: false,
    requiresSeparateImplementationApproval: false,
    reason: 'Refresh inventory is implemented as a harmless Electron-main handler. It reuses the sanitized inventory collector and records audit events without shell execution.',
  };
}

function plannedHandler(desktopApi: AllowlistedRuntimeActionApi): RuntimeActionAllowlistedHandlerContract {
  return {
    desktopApi,
    status: 'planned_not_implemented',
    owner: 'electron_main',
    executable: false,
    rendererCanInvoke: false,
    acceptsRendererCommand: false,
    requiresShell: false,
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
    state: 'partial_harmless_execution',
    registryImplemented: true,
    handlersExecutable: true,
    rendererCanRegisterHandlers: false,
    rendererCanExecuteArbitraryHandlers: false,
    ipc: {
      registerChannel: null,
      executeChannel: null,
      refreshInventoryChannel: 'runtimeActions:refreshInventory',
    },
    handlers: ALLOWLISTED_RUNTIME_ACTION_APIS.map((api) => (
      api === 'runtime.refreshInventory' ? implementedRefreshInventoryHandler() : plannedHandler(api)
    )),
    guardrails: HANDLER_REGISTRY_GUARDRAILS,
  };
}

export function buildRuntimeActionHandlerReadinessReport(
  contract: RuntimeActionAllowlistedHandlerRegistryContract,
): RuntimeActionHandlerReadinessReport {
  const implementedHandlerCount = contract.handlers.filter((handler) => handler.status === 'implemented').length;
  const executableHandlerCount = contract.handlers.filter((handler) => handler.executable).length;
  return {
    schemaVersion: 1,
    readyForExecution: implementedHandlerCount === 1 && executableHandlerCount === 1,
    implementedHandlerCount,
    executableHandlerCount,
    totalAllowlistedHandlerCount: contract.handlers.length,
    message: 'Only runtime.refreshInventory is executable. Command-capable runtime actions remain unavailable until separately approved and implemented.',
  };
}

export function validateRuntimeActionHandlerRegistryContract(
  contract: RuntimeActionAllowlistedHandlerRegistryContract,
): RuntimeActionHandlerRegistryValidation {
  if (contract.state !== 'partial_harmless_execution' || !contract.registryImplemented || !contract.handlersExecutable) {
    return { valid: false, reason: 'Handler registry must explicitly represent the partial harmless execution state.' };
  }
  if (contract.rendererCanRegisterHandlers || contract.rendererCanExecuteArbitraryHandlers) {
    return { valid: false, reason: 'Renderer cannot register handlers or invoke arbitrary runtime action handlers.' };
  }
  if (contract.ipc.registerChannel !== null || contract.ipc.executeChannel !== null) {
    return { valid: false, reason: 'Handler registry contract must not expose generic registration or execution IPC channels.' };
  }
  if (contract.ipc.refreshInventoryChannel !== 'runtimeActions:refreshInventory') {
    return { valid: false, reason: 'Refresh inventory must use the narrow runtimeActions:refreshInventory IPC channel.' };
  }

  const refreshHandlers = contract.handlers.filter((handler) => handler.desktopApi === 'runtime.refreshInventory');
  if (refreshHandlers.length !== 1) return { valid: false, reason: 'Exactly one refresh inventory handler must be defined.' };
  const [refresh] = refreshHandlers;
  if (
    refresh.status !== 'implemented'
    || refresh.executable !== true
    || refresh.rendererCanInvoke !== true
    || refresh.acceptsRendererCommand !== false
    || refresh.requiresShell !== false
    || refresh.requiresSeparateImplementationApproval !== false
  ) {
    return { valid: false, reason: 'Refresh inventory must be the only harmless executable handler and must not accept commands or shell execution.' };
  }

  const unsafeImplemented = contract.handlers.some((handler) => handler.desktopApi !== 'runtime.refreshInventory'
    && (handler.status !== 'planned_not_implemented' || handler.executable || handler.rendererCanInvoke));
  if (unsafeImplemented) {
    return { valid: false, reason: 'Only refresh inventory may be implemented in this slice.' };
  }
  if (contract.handlers.some((handler) => handler.acceptsRendererCommand || handler.requiresShell)) {
    return { valid: false, reason: 'No runtime action handler may accept renderer commands or require shell execution in this contract.' };
  }
  return { valid: true, reason: 'Handler registry exposes only the harmless refresh inventory action and no generic execution surface.' };
}
