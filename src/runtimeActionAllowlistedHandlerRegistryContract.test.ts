import { describe, expect, it } from 'vitest';
import {
  buildRuntimeActionAllowlistedHandlerRegistryContract,
  buildRuntimeActionHandlerReadinessReport,
  validateRuntimeActionHandlerRegistryContract,
} from './runtimeActionAllowlistedHandlerRegistryContract';
import { ALLOWLISTED_RUNTIME_ACTION_APIS } from './runtimeActionAllowlist';

describe('runtime action allowlisted handler registry contract', () => {
  it('documents every allowlisted API as planned but not implemented', () => {
    const contract = buildRuntimeActionAllowlistedHandlerRegistryContract();

    expect(contract).toMatchObject({
      schemaVersion: 1,
      owner: 'electron_main',
      state: 'model_only',
      registryImplemented: false,
      handlersExecutable: false,
      rendererCanRegisterHandlers: false,
      rendererCanExecuteHandlers: false,
      ipc: {
        executeChannel: null,
        registerChannel: null,
      },
    });
    expect(contract.handlers.map((handler) => handler.desktopApi).sort()).toEqual([...ALLOWLISTED_RUNTIME_ACTION_APIS].sort());
    expect(contract.handlers.every((handler) => handler.status === 'planned_not_implemented')).toBe(true);
    expect(contract.handlers.every((handler) => handler.executable === false && handler.requiresSeparateImplementationApproval === true)).toBe(true);
  });

  it('builds a readiness report that blocks execution until real handlers are separately approved', () => {
    const report = buildRuntimeActionHandlerReadinessReport(buildRuntimeActionAllowlistedHandlerRegistryContract());

    expect(report).toMatchObject({
      schemaVersion: 1,
      readyForExecution: false,
      implementedHandlerCount: 0,
      executableHandlerCount: 0,
      totalAllowlistedHandlerCount: ALLOWLISTED_RUNTIME_ACTION_APIS.length,
    });
    expect(report.message).toContain('No allowlisted runtime action handlers are implemented');
  });

  it('rejects executable-looking handler registry contracts', () => {
    const contract = buildRuntimeActionAllowlistedHandlerRegistryContract();
    const invalid = {
      ...contract,
      registryImplemented: true,
      handlersExecutable: true,
      handlers: contract.handlers.map((handler, index) => index === 0
        ? { ...handler, status: 'implemented', executable: true }
        : handler),
    };

    expect(validateRuntimeActionHandlerRegistryContract(contract)).toEqual({
      valid: true,
      reason: 'Handler registry contract is model-only and non-executable.',
    });
    expect(validateRuntimeActionHandlerRegistryContract(invalid as never).valid).toBe(false);
  });
});
