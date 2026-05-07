const { collectLocalInventory: defaultCollectLocalInventory } = require('./systemInventory.cjs');
const { appendRuntimeActionAuditEvents: defaultAppendRuntimeActionAuditEvents } = require('./runtimeActionAuditStore.cjs');

const ALLOWLISTED_DESKTOP_APIS = new Set([
  'runtime.refreshInventory',
  'runtime.runHealthCheck',
  'runtime.openDocumentation',
  'runtime.previewInstallerRecipe',
  'runtime.openConfigurationGuide',
]);

function listRuntimeActionHandlerRegistry() {
  return {
    schemaVersion: 1,
    owner: 'electron_main',
    rendererCanExecuteArbitraryActions: false,
    genericExecuteChannel: null,
    handlers: {
      'runtime.refreshInventory': {
        desktopApi: 'runtime.refreshInventory',
        status: 'implemented',
        executable: true,
        executionKind: 'harmless_inventory_refresh',
        acceptsRendererCommand: false,
        requiresShell: false,
        requiresNativeConfirmation: false,
        auditRequired: true,
        reason: 'Refreshes sanitized desktop inventory through the existing Electron main inventory collector. No shell command or renderer-provided command is accepted.',
      },
      'runtime.runHealthCheck': plannedHandler('runtime.runHealthCheck'),
      'runtime.openDocumentation': plannedHandler('runtime.openDocumentation'),
      'runtime.previewInstallerRecipe': plannedHandler('runtime.previewInstallerRecipe'),
      'runtime.openConfigurationGuide': plannedHandler('runtime.openConfigurationGuide'),
    },
  };
}

function plannedHandler(desktopApi) {
  return {
    desktopApi,
    status: 'planned_not_implemented',
    executable: false,
    executionKind: null,
    acceptsRendererCommand: false,
    requiresShell: false,
    requiresNativeConfirmation: true,
    auditRequired: true,
    reason: 'This desktop API is allowlisted for future implementation only. No executable handler exists yet.',
  };
}

async function executeAllowlistedRuntimeAction(payload, deps = {}) {
  const request = validateRuntimeActionRequest(payload);
  const registry = listRuntimeActionHandlerRegistry();
  const handler = registry.handlers[request.desktopApi];
  if (!handler || handler.executable !== true) {
    throw new Error(`No executable allowlisted handler for ${request.desktopApi}`);
  }

  if (request.desktopApi === 'runtime.refreshInventory') {
    return executeRefreshInventory(request, deps);
  }

  throw new Error(`No executable allowlisted handler for ${request.desktopApi}`);
}

async function executeRefreshInventory(request, deps = {}) {
  const collectLocalInventory = deps.collectLocalInventory || defaultCollectLocalInventory;
  const appendRuntimeActionAuditEvents = deps.appendRuntimeActionAuditEvents || defaultAppendRuntimeActionAuditEvents;
  const now = deps.now || (() => new Date().toISOString());
  const requestedAt = now();
  const inventory = await collectLocalInventory();
  const completedAt = now();
  const result = {
    schemaVersion: 1,
    status: 'succeeded',
    desktopApi: 'runtime.refreshInventory',
    correlationId: request.correlationId,
    runtimeId: 'local-inventory',
    actionKind: 'refresh_inventory',
    source: request.source,
    rendererCanExecuteArbitraryActions: false,
    executedShell: false,
    inventory,
    message: 'Local desktop inventory was refreshed through an allowlisted Electron main handler.',
  };

  appendRuntimeActionAuditEvents([
    buildAuditEvent({
      eventType: 'runtime_action_requested',
      occurredAt: requestedAt,
      correlationId: request.correlationId,
      outcome: 'accepted',
      resultMessage: 'Refresh inventory request accepted by allowlisted Electron main handler.',
    }),
    buildAuditEvent({
      eventType: 'runtime_action_completed',
      occurredAt: completedAt,
      correlationId: request.correlationId,
      outcome: 'succeeded',
      resultMessage: 'Refresh inventory completed without shell execution.',
    }),
  ]);

  return result;
}

function validateRuntimeActionRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Runtime action request must be an object');
  }
  const desktopApi = payload.desktopApi;
  if (typeof desktopApi !== 'string' || !ALLOWLISTED_DESKTOP_APIS.has(desktopApi)) {
    throw new Error('Invalid runtime action desktop API');
  }
  if ('command' in payload || 'args' in payload || 'shell' in payload) {
    throw new Error('Runtime action request cannot include command, args, or shell fields');
  }
  return {
    desktopApi,
    source: sanitizeToken(payload.source || 'renderer', 'renderer'),
    correlationId: sanitizeToken(payload.correlationId || `corr_${Date.now()}`, `corr_${Date.now()}`),
  };
}

function sanitizeToken(value, fallback) {
  const text = String(value || '');
  if (/^[A-Za-z0-9._:-]{1,80}$/.test(text)) return text;
  return fallback;
}

function buildAuditEvent({ eventType, occurredAt, correlationId, outcome, resultMessage }) {
  return {
    schemaVersion: 1,
    eventType,
    occurredAt,
    correlationId,
    runtimeId: 'local-inventory',
    actionKind: 'refresh_inventory',
    source: 'renderer',
    submitState: 'desktop_handler',
    outcome,
    safeForLog: true,
    redactedFields: [],
    payloadSummary: 'Refresh sanitized local inventory using the allowlisted Electron main handler.',
    resultMessage,
  };
}

module.exports = {
  executeAllowlistedRuntimeAction,
  listRuntimeActionHandlerRegistry,
};
