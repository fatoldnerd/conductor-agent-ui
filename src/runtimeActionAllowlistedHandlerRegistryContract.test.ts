import { describe, expect, it } from 'vitest';
import {
  buildRuntimeActionAllowlistedHandlerRegistryContract,
  buildRuntimeActionHandlerReadinessReport,
  validateRuntimeActionHandlerRegistryContract,
} from './runtimeActionAllowlistedHandlerRegistryContract';
import { ALLOWLISTED_RUNTIME_ACTION_APIS } from './runtimeActionAllowlist';

describe('runtime action allowlisted handler registry contract', () => {
  it('documents refresh inventory as the only implemented harmless handler', () => {
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
      },
    });
    expect(contract.handlers.map((handler) => handler.desktopApi).sort()).toEqual([...ALLOWLISTED_RUNTIME_ACTION_APIS].sort());
    const refresh = contract.handlers.find((handler) => handler.desktopApi === 'runtime.refreshInventory');
    expect(refresh).toMatchObject({
      status: 'implemented',
      executable: true,
      rendererCanInvoke: true,
      acceptsRendererCommand: false,
      requiresShell: false,
      requiresSeparateImplementationApproval: false,
    });
    expect(contract.handlers
      .filter((handler) => handler.desktopApi !== 'runtime.refreshInventory')
      .every((handler) => handler.status === 'planned_not_implemented' && handler.executable === false)).toBe(true);
  });

  it('builds a readiness report that allows only harmless inventory refresh execution', () => {
    const report = buildRuntimeActionHandlerReadinessReport(buildRuntimeActionAllowlistedHandlerRegistryContract());

    expect(report).toMatchObject({
      schemaVersion: 1,
      readyForExecution: true,
      implementedHandlerCount: 1,
      executableHandlerCount: 1,
      totalAllowlistedHandlerCount: ALLOWLISTED_RUNTIME_ACTION_APIS.length,
    });
    expect(report.message).toContain('Only runtime.refreshInventory is executable');
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
      reason: 'Handler registry exposes only the harmless refresh inventory action and no generic execution surface.',
    });
    expect(validateRuntimeActionHandlerRegistryContract(invalid as never).valid).toBe(false);
    expect(validateRuntimeActionHandlerRegistryContract(invalidShell as never).valid).toBe(false);
  });
});
