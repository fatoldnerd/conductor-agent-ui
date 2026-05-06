import { describe, expect, it } from 'vitest';
import {
  buildRuntimeActionExecutionPlanningContract,
  buildRuntimeActionExecutionPlanPreview,
  validateRuntimeActionExecutionPlanPreview,
} from './runtimeActionExecutionPlanningContract';

function confirmedNativeConfirmation(overrides = {}) {
  return {
    schemaVersion: 1 as const,
    status: 'confirmed_no_execution' as const,
    correlationId: 'corr_execution_plan_1',
    confirmedAt: '2026-05-06T19:30:00.000Z',
    runtimeId: 'claude-code',
    actionKind: 'desktop_api',
    source: 'renderer',
    nativeConfirmation: {
      required: true,
      shown: true,
      confirmed: true,
      implemented: true,
      reason: 'Native confirmation accepted for token=abc123 /Users/brad/private',
    },
    execution: {
      rendererCanExecute: false,
      executed: false,
      reason: 'Execution not implemented. command bash -lc should redact.',
    },
    message: 'Native confirmation completed. No action executed.',
    ...overrides,
  };
}

describe('runtime action execution planning contract', () => {
  it('documents a model-only Electron-main future execution boundary with no executable API', () => {
    const contract = buildRuntimeActionExecutionPlanningContract();

    expect(contract).toMatchObject({
      schemaVersion: 1,
      owner: 'electron_main',
      state: 'model_only',
      rendererAccess: {
        canReadPreview: true,
        canPlan: false,
        canExecute: false,
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
      },
    });
    expect(contract.guardrails).toContain('No runtime action execution handler exists in this contract.');
  });

  it('builds a redacted non-executable plan preview only after confirmed native confirmation', () => {
    const preview = buildRuntimeActionExecutionPlanPreview({
      confirmation: confirmedNativeConfirmation(),
      desktopApi: 'runtime.refreshInventory',
    });

    expect(preview).toMatchObject({
      schemaVersion: 1,
      state: 'planning_preview_only',
      owner: 'electron_main',
      correlationId: 'corr_execution_plan_1',
      runtimeId: 'claude-code',
      actionKind: 'desktop_api',
      source: 'renderer',
      desktopApi: 'runtime.refreshInventory',
      rendererCanExecute: false,
      executionImplemented: false,
      wouldExecute: false,
      requiresSeparateImplementationApproval: true,
    });
    expect(preview.summary).toContain('model-only');
    expect(preview.reason).not.toContain('/Users/brad');
    expect(preview.reason).not.toContain('token=abc123');
    expect(validateRuntimeActionExecutionPlanPreview(preview)).toEqual({
      valid: true,
      reason: 'Execution plan preview is non-executable and model-only.',
    });
  });

  it('blocks unconfirmed, invalid, unallowlisted, or executable-looking inputs', () => {
    const cancelled = buildRuntimeActionExecutionPlanPreview({
      confirmation: confirmedNativeConfirmation({ status: 'cancelled_no_execution' }),
      desktopApi: 'runtime.refreshInventory',
    });
    const unallowlisted = buildRuntimeActionExecutionPlanPreview({
      confirmation: confirmedNativeConfirmation(),
      desktopApi: 'runtime.runShellCommand',
    });
    const executableLooking = buildRuntimeActionExecutionPlanPreview({
      confirmation: confirmedNativeConfirmation({ execution: { rendererCanExecute: true, executed: false, reason: 'bad' } }),
      desktopApi: 'runtime.refreshInventory',
    });

    expect(cancelled.state).toBe('blocked');
    expect(unallowlisted.state).toBe('blocked');
    expect(unallowlisted.desktopApi).toBeNull();
    expect(executableLooking.state).toBe('blocked');
    expect([cancelled, unallowlisted, executableLooking].every((preview) => preview.rendererCanExecute === false && preview.wouldExecute === false)).toBe(true);
  });
});
