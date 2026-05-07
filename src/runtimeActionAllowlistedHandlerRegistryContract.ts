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
    openDocumentationChannel: 'runtimeActions:openDocumentation';
    runHealthCheckChannel: 'runtimeActions:runHealthCheck';
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

const IMPLEMENTED_EXECUTABLE_APIS: AllowlistedRuntimeActionApi[] = [
  'runtime.refreshInventory',
  'runtime.openDocumentation',
  'runtime.runHealthCheck',
];

const HANDLER_REGISTRY_GUARDRAILS = [
  'Only runtime.refreshInventory, runtime.openDocumentation, and runtime.runHealthCheck have executable handlers.',
  'Renderer cannot register handlers or invoke a generic runtime action executor.',
  'The refresh inventory handler accepts no renderer command, args, shell, path, or environment payload.',
  'The open documentation handler accepts only a recipe id and resolves exact allowlisted HTTPS URLs in Electron main.',
  'The health check handler accepts only a runtime id and health check id; Electron main owns the exact command and uses shell:false.',
  'All other command-capable or mutating handlers remain planned and non-executable until separate implementation approval.',
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

function implementedOpenDocumentationHandler(): RuntimeActionAllowlistedHandlerContract {
  return {
    desktopApi: 'runtime.openDocumentation',
    status: 'implemented',
    owner: 'electron_main',
    executable: true,
    rendererCanInvoke: true,
    acceptsRendererCommand: false,
    requiresShell: false,
    requiresApprovalDecision: false,
    requiresNativeConfirmation: false,
    requiresSeparateImplementationApproval: false,
    reason: 'Open documentation is implemented as a harmless Electron-main handler. The renderer supplies only a recipe id; Electron main resolves an exact allowlisted HTTPS documentation URL and records audit events without shell execution.',
  };
}

function implementedHealthCheckHandler(): RuntimeActionAllowlistedHandlerContract {
  return {
    desktopApi: 'runtime.runHealthCheck',
    status: 'implemented',
    owner: 'electron_main',
    executable: true,
    rendererCanInvoke: true,
    acceptsRendererCommand: false,
    requiresShell: false,
    requiresApprovalDecision: false,
    requiresNativeConfirmation: false,
    requiresSeparateImplementationApproval: false,
    reason: 'Run health check is implemented for one constrained Hermes version check only. The renderer supplies runtime id and health check id; Electron main owns the exact command, runs with shell:false, sanitizes output, and records audit events.',
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
      openDocumentationChannel: 'runtimeActions:openDocumentation',
      runHealthCheckChannel: 'runtimeActions:runHealthCheck',
    },
    handlers: ALLOWLISTED_RUNTIME_ACTION_APIS.map((api) => {
      if (api === 'runtime.refreshInventory') return implementedRefreshInventoryHandler();
      if (api === 'runtime.openDocumentation') return implementedOpenDocumentationHandler();
      if (api === 'runtime.runHealthCheck') return implementedHealthCheckHandler();
      return plannedHandler(api);
    }),
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
    readyForExecution: implementedHandlerCount === 3 && executableHandlerCount === 3,
    implementedHandlerCount,
    executableHandlerCount,
    totalAllowlistedHandlerCount: contract.handlers.length,
    message: 'Only runtime.refreshInventory, runtime.openDocumentation, and runtime.runHealthCheck are executable. Other command-capable runtime actions remain unavailable until separately approved and implemented.',
  };
}

function implementedHandlerValid(handler: RuntimeActionAllowlistedHandlerContract): boolean {
  return handler.status === 'implemented'
    && handler.executable === true
    && handler.rendererCanInvoke === true
    && handler.acceptsRendererCommand === false
    && handler.requiresShell === false
    && handler.requiresSeparateImplementationApproval === false;
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
  if (contract.ipc.openDocumentationChannel !== 'runtimeActions:openDocumentation') {
    return { valid: false, reason: 'Open documentation must use the narrow runtimeActions:openDocumentation IPC channel.' };
  }
  if (contract.ipc.runHealthCheckChannel !== 'runtimeActions:runHealthCheck') {
    return { valid: false, reason: 'Run health check must use the narrow runtimeActions:runHealthCheck IPC channel.' };
  }

  for (const desktopApi of IMPLEMENTED_EXECUTABLE_APIS) {
    const handlers = contract.handlers.filter((handler) => handler.desktopApi === desktopApi);
    if (handlers.length !== 1) return { valid: false, reason: `Exactly one ${desktopApi} handler must be defined.` };
    if (!implementedHandlerValid(handlers[0])) return { valid: false, reason: `${desktopApi} must be implemented without renderer commands or shell execution.` };
  }

  const unsafeImplemented = contract.handlers.some((handler) => !IMPLEMENTED_EXECUTABLE_APIS.includes(handler.desktopApi)
    && (handler.status !== 'planned_not_implemented' || handler.executable || handler.rendererCanInvoke));
  if (unsafeImplemented) {
    return { valid: false, reason: 'Only refresh inventory, open documentation, and the constrained health check may be implemented in this slice.' };
  }
  if (contract.handlers.some((handler) => handler.acceptsRendererCommand || handler.requiresShell)) {
    return { valid: false, reason: 'No runtime action handler may accept renderer commands or require shell execution in this contract.' };
  }
  return { valid: true, reason: 'Handler registry exposes only refresh inventory, open documentation, and constrained health check actions and no generic execution surface.' };
}
