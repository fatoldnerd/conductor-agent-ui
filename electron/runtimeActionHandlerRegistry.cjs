const { collectLocalInventory: defaultCollectLocalInventory } = require('./systemInventory.cjs');
const { appendRuntimeActionAuditEvents: defaultAppendRuntimeActionAuditEvents } = require('./runtimeActionAuditStore.cjs');
const { execFile: nodeExecFile } = require('node:child_process');
const { promisify } = require('node:util');

const defaultExecFile = promisify(nodeExecFile);

const DOCUMENTATION_URLS = {
  'claude-code': 'https://docs.anthropic.com/en/docs/claude-code',
  'codex-cli': 'https://github.com/openai/codex',
  'gemini-cli': 'https://github.com/google-gemini/gemini-cli',
  'hermes-agent': 'https://hermes-agent.nousresearch.com/docs',
  openclaw: 'https://github.com/outsourc-e/OpenClaw',
};

const HEALTH_CHECKS = {
  'hermes-agent': {
    'hermes-version': {
      command: 'hermes',
      args: ['--version'],
      timeout: 5000,
      commandLabel: 'hermes --version',
    },
  },
};

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
      'runtime.runHealthCheck': {
        desktopApi: 'runtime.runHealthCheck',
        status: 'implemented',
        executable: true,
        executionKind: 'constrained_health_check',
        acceptsRendererCommand: false,
        requiresShell: false,
        requiresNativeConfirmation: false,
        auditRequired: true,
        reason: 'Runs one exact allowlisted health check through execFile with shell:false. Renderer supplies runtime id and health check id only, never command text or args.',
      },
      'runtime.openDocumentation': {
        desktopApi: 'runtime.openDocumentation',
        status: 'implemented',
        executable: true,
        executionKind: 'harmless_open_https_documentation',
        acceptsRendererCommand: false,
        requiresShell: false,
        requiresNativeConfirmation: false,
        auditRequired: true,
        reason: 'Opens exact allowlisted HTTPS documentation URLs through Electron shell.openExternal. Renderer supplies a recipe id only, never a raw URL or command.',
      },
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

  if (request.desktopApi === 'runtime.openDocumentation') {
    return executeOpenDocumentation(request, deps);
  }

  if (request.desktopApi === 'runtime.runHealthCheck') {
    return executeHealthCheck(request, deps);
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

async function executeOpenDocumentation(request, deps = {}) {
  const openExternal = deps.openExternal;
  if (typeof openExternal !== 'function') throw new Error('Documentation opener is unavailable');
  const appendRuntimeActionAuditEvents = deps.appendRuntimeActionAuditEvents || defaultAppendRuntimeActionAuditEvents;
  const now = deps.now || (() => new Date().toISOString());
  const docsTarget = sanitizeDocsTarget(request.docsTarget);
  const url = resolveDocumentationUrl(docsTarget, deps);
  if (!isAllowlistedHttpsUrl(url)) throw new Error('Documentation URL is not an allowlisted HTTPS URL');

  const occurredAt = now();
  await openExternal(url);
  appendRuntimeActionAuditEvents([
    buildAuditEvent({
      eventType: 'runtime_action_completed',
      occurredAt,
      correlationId: request.correlationId,
      actionKind: 'open_documentation',
      outcome: 'succeeded',
      payloadSummary: `Open documentation for ${docsTarget}.`,
      resultMessage: 'Documentation opened through Electron shell.openExternal using an allowlisted HTTPS URL.',
    }),
  ]);

  return {
    schemaVersion: 1,
    status: 'succeeded',
    desktopApi: 'runtime.openDocumentation',
    correlationId: request.correlationId,
    runtimeId: docsTarget,
    actionKind: 'open_documentation',
    docsTarget,
    openedUrl: url,
    source: request.source,
    rendererCanExecuteArbitraryActions: false,
    executedShell: false,
    message: 'Documentation was opened through an allowlisted Electron main handler.',
  };
}

async function executeHealthCheck(request, deps = {}) {
  const execFile = deps.execFile || defaultExecFile;
  const appendRuntimeActionAuditEvents = deps.appendRuntimeActionAuditEvents || defaultAppendRuntimeActionAuditEvents;
  const now = deps.now || (() => new Date().toISOString());
  const runtimeId = sanitizeRuntimeId(request.runtimeId);
  const healthCheckId = sanitizeToken(request.healthCheckId, '');
  const spec = HEALTH_CHECKS[runtimeId]?.[healthCheckId];
  if (!spec) throw new Error('Health check is not implemented in the exact allowlist');

  const occurredAt = now();
  let output;
  let status = 'succeeded';
  let message = 'Health check completed through an exact allowlisted Electron main handler.';
  try {
    output = await execFile(spec.command, spec.args, {
      shell: false,
      timeout: spec.timeout,
      windowsHide: true,
      maxBuffer: 64 * 1024,
    });
  } catch (error) {
    status = 'failed';
    output = { stdout: error?.stdout || '', stderr: error?.stderr || '' };
    message = sanitizeOutput(error?.message || 'Health check failed');
  }

  const stdoutPreview = sanitizeOutput(output?.stdout || '');
  const stderrPreview = sanitizeOutput(output?.stderr || '');
  appendRuntimeActionAuditEvents([
    buildAuditEvent({
      eventType: 'runtime_action_completed',
      occurredAt,
      correlationId: request.correlationId,
      runtimeId,
      actionKind: 'health_check',
      outcome: status,
      payloadSummary: `Run ${healthCheckId} for ${runtimeId} using exact allowlisted command label ${spec.commandLabel}.`,
      resultMessage: status === 'succeeded' ? 'Health check completed without shell execution.' : message,
    }),
  ]);

  return {
    schemaVersion: 1,
    status,
    desktopApi: 'runtime.runHealthCheck',
    correlationId: request.correlationId,
    runtimeId,
    actionKind: 'health_check',
    healthCheckId,
    commandLabel: spec.commandLabel,
    source: request.source,
    rendererCanExecuteArbitraryActions: false,
    executedShell: false,
    stdoutPreview,
    stderrPreview,
    message,
  };
}

function resolveDocumentationUrl(docsTarget, deps = {}) {
  const recipe = typeof deps.listIntegrationRecipes === 'function'
    ? deps.listIntegrationRecipes().find((item) => item.id === docsTarget)
    : null;
  return recipe?.docsUrl || DOCUMENTATION_URLS[docsTarget] || null;
}

function sanitizeDocsTarget(value) {
  const text = String(value || '');
  if (/^[a-z0-9-]{1,60}$/.test(text)) return text;
  throw new Error('Invalid documentation target');
}

function sanitizeRuntimeId(value) {
  const text = String(value || '');
  if (/^[a-z0-9-]{1,60}$/.test(text)) return text;
  throw new Error('Invalid runtime id');
}

function isAllowlistedHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Object.values(DOCUMENTATION_URLS).includes(value);
  } catch {
    return false;
  }
}

function sanitizeOutput(value) {
  return String(value || '')
    .replace(/\/Users\/[^\s/]+/g, '[redacted-home]')
    .replace(/\/home\/[^\s/]+/g, '[redacted-home]')
    .replace(/\/root\b/g, '[redacted-home]')
    .replace(/token[=:\s]+[^\s]+/gi, 'token=[redacted]')
    .trim()
    .slice(0, 2000);
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
    docsTarget: payload.docsTarget,
    runtimeId: payload.runtimeId,
    healthCheckId: payload.healthCheckId,
  };
}

function sanitizeToken(value, fallback) {
  const text = String(value || '');
  if (/^[A-Za-z0-9._:-]{1,80}$/.test(text)) return text;
  return fallback;
}

function buildAuditEvent({
  eventType,
  occurredAt,
  correlationId,
  outcome,
  resultMessage,
  actionKind = 'refresh_inventory',
  runtimeId = 'local-inventory',
  payloadSummary = 'Refresh sanitized local inventory using the allowlisted Electron main handler.',
}) {
  return {
    schemaVersion: 1,
    eventType,
    occurredAt,
    correlationId,
    runtimeId,
    actionKind,
    source: 'renderer',
    submitState: 'desktop_handler',
    outcome,
    safeForLog: true,
    redactedFields: [],
    payloadSummary,
    resultMessage,
  };
}

module.exports = {
  executeAllowlistedRuntimeAction,
  listRuntimeActionHandlerRegistry,
};
