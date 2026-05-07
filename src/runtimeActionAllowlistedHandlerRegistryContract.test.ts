import { describe, expect, it } from 'vitest';
import {
  buildRuntimeActionAllowlistedHandlerRegistryContract,
  buildRuntimeActionHandlerReadinessReport,
  validateRuntimeActionHandlerRegistryContract,
} from './runtimeActionAllowlistedHandlerRegistryContract';
import { ALLOWLISTED_RUNTIME_ACTION_APIS } from './runtimeActionAllowlist';

describe('runtime action allowlisted handler registry contract', () => {
  it('documents refresh inventory, open docs, and constrained health check as the only implemented handlers', () => {
    const contract = buildRuntimeActionAllowlistedHandlerRegistryContract();

    expect(contract).toMatchObject({
      schemaVersion: 1,
      owner: 'electron_main',
      state: 'partial_harmless_execution',
      registryImplemented: true,
      handlersExecutable: true,
      rendererCanRegisterHandlers: false,
      rendererCanExecuteArbitraryHandlers: false,
      ipc: {
        executeChannel: null,
        registerChannel: null,
        refreshInventoryChannel: 'runtimeActions:refreshInventory',
        openDocumentationChannel: 'runtimeActions:openDocumentation',
        runHealthCheckChannel: 'runtimeActions:runHealthCheck',
      },

    });
    expect(contract.handlers.map((handler) => handler.desktopApi).sort()).toEqual([...ALLOWLISTED_RUNTIME_ACTION_APIS].sort());
    const refresh = contract.handlers.find((handler) => handler.desktopApi === 'runtime.refreshInventory');
    const docs = contract.handlers.find((handler) => handler.desktopApi === 'runtime.openDocumentation');
    const health = contract.handlers.find((handler) => handler.desktopApi === 'runtime.runHealthCheck');
    expect(refresh).toMatchObject({
      status: 'implemented',
      executable: true,
      rendererCanInvoke: true,
      acceptsRendererCommand: false,
      requiresShell: false,
      requiresSeparateImplementationApproval: false,
    });
    expect(docs).toMatchObject({
      status: 'implemented',
      executable: true,
      rendererCanInvoke: true,
      acceptsRendererCommand: false,
      requiresShell: false,
      requiresSeparateImplementationApproval: false,
    });
    expect(health).toMatchObject({
      status: 'implemented',
      executable: true,
      rendererCanInvoke: true,
      acceptsRendererCommand: false,
      requiresShell: false,
      requiresSeparateImplementationApproval: false,
    });
    expect(contract.handlers
      .filter((handler) => !['runtime.refreshInventory', 'runtime.openDocumentation', 'runtime.runHealthCheck'].includes(handler.desktopApi))
      .every((handler) => handler.status === 'planned_not_implemented' && handler.executable === false)).toBe(true);
  });

  it('builds a readiness report that allows only implemented safe runtime actions', () => {
    const report = buildRuntimeActionHandlerReadinessReport(buildRuntimeActionAllowlistedHandlerRegistryContract());

    expect(report).toMatchObject({
      schemaVersion: 1,
      readyForExecution: true,
      implementedHandlerCount: 3,
      executableHandlerCount: 3,
      totalAllowlistedHandlerCount: ALLOWLISTED_RUNTIME_ACTION_APIS.length,
    });
    expect(report.message).toContain('Only runtime.refreshInventory, runtime.openDocumentation, and runtime.runHealthCheck are executable');
  });

  it('rejects generic execution or shell-capable handler registry contracts', () => {
    const contract = buildRuntimeActionAllowlistedHandlerRegistryContract();
    const invalid = {
      ...contract,
      rendererCanExecuteArbitraryHandlers: true,
      ipc: { ...contract.ipc, executeChannel: 'runtimeActions:execute' },
    };
    const invalidShell = {
      ...contract,
      handlers: contract.handlers.map((handler) => handler.desktopApi === 'runtime.refreshInventory'
        ? { ...handler, acceptsRendererCommand: true, requiresShell: true }
        : handler),
    };

    expect(validateRuntimeActionHandlerRegistryContract(contract)).toEqual({
      valid: true,
      reason: 'Handler registry exposes only refresh inventory, open documentation, and constrained health check actions and no generic execution surface.',
    });
    expect(validateRuntimeActionHandlerRegistryContract(invalid as never).valid).toBe(false);
    expect(validateRuntimeActionHandlerRegistryContract(invalidShell as never).valid).toBe(false);
  });
});
