import { describe, expect, it } from 'vitest';
import {
  ALLOWLISTED_RUNTIME_ACTION_APIS,
  buildRuntimeActionExecutionContract,
  isAllowlistedRuntimeActionApi,
  type FutureExecutableRuntimeAction,
} from './runtimeActionAllowlist';
import { safeAction } from './runtimeReadiness';

describe('runtime action allowlist contract', () => {
  it('keeps preview-only runtime actions metadata-only with no executable desktop API', () => {
    const contract = buildRuntimeActionExecutionContract(safeAction('preview_install'));

    expect(contract).toMatchObject({
      status: 'metadata_only',
      canExecuteFromRenderer: false,
      allowlistedDesktopApi: null,
      requiresExplicitApproval: true,
    });
    expect(contract.guardrails).toEqual(expect.arrayContaining([
      'Renderer cannot execute shell commands.',
      'Metadata-only actions may show previews, requirements, and expected effects only.',
    ]));
  });

  it('allows only named desktop API contracts, never raw shell commands', () => {
    expect(ALLOWLISTED_RUNTIME_ACTION_APIS).toContain('runtime.refreshInventory');
    expect(isAllowlistedRuntimeActionApi('runtime.refreshInventory')).toBe(true);
    expect(isAllowlistedRuntimeActionApi('shell.exec')).toBe(false);
    expect(isAllowlistedRuntimeActionApi('bash -lc npm install')).toBe(false);
  });

  it('blocks future executable actions that do not name an allowlisted desktop API', () => {
    const futureAction = {
      ...safeAction('health_check'),
      executesCommand: true,
      previewOnly: false,
      allowlistedDesktopApi: null,
    } satisfies FutureExecutableRuntimeAction;

    const contract = buildRuntimeActionExecutionContract(futureAction);

    expect(contract).toMatchObject({
      status: 'blocked_unallowlisted',
      canExecuteFromRenderer: false,
      allowlistedDesktopApi: null,
      requiresExplicitApproval: true,
    });
    expect(contract.reason).toContain('No allowlisted Electron API');
  });

  it('blocks future executable actions that name a non-allowlisted API', () => {
    const futureAction = {
      ...safeAction('configure'),
      executesCommand: true,
      previewOnly: false,
      allowlistedDesktopApi: 'shell.exec',
    } satisfies FutureExecutableRuntimeAction;

    const contract = buildRuntimeActionExecutionContract(futureAction);

    expect(contract).toMatchObject({
      status: 'blocked_unallowlisted',
      canExecuteFromRenderer: false,
      allowlistedDesktopApi: null,
    });
    expect(contract.reason).toContain('not in the runtime action allowlist');
  });

  it('marks future allowlisted executable actions as desktop-gated and approval-gated, not renderer executable', () => {
    const futureAction = {
      ...safeAction('refresh'),
      executesCommand: true,
      previewOnly: false,
      allowlistedDesktopApi: 'runtime.refreshInventory',
    } satisfies FutureExecutableRuntimeAction;

    const contract = buildRuntimeActionExecutionContract(futureAction);

    expect(contract).toMatchObject({
      status: 'desktop_api_gated',
      canExecuteFromRenderer: false,
      allowlistedDesktopApi: 'runtime.refreshInventory',
      requiresExplicitApproval: false,
    });
    expect(contract.guardrails).toEqual(expect.arrayContaining([
      'Execution, if implemented later, must be routed through Electron main/preload.',
      'Renderer receives an action request contract, never a shell command.',
    ]));
  });
});
