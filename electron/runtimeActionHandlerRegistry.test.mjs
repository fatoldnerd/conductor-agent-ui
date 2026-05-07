import { describe, expect, it, vi } from 'vitest';
import {
  executeAllowlistedRuntimeAction,
  listRuntimeActionHandlerRegistry,
} from './runtimeActionHandlerRegistry.cjs';

describe('runtime action handler registry', () => {
  it('registers only the harmless refresh inventory handler as executable', () => {
    const registry = listRuntimeActionHandlerRegistry();

    expect(registry.schemaVersion).toBe(1);
    expect(registry.owner).toBe('electron_main');
    expect(registry.rendererCanExecuteArbitraryActions).toBe(false);
    expect(registry.handlers['runtime.refreshInventory']).toMatchObject({
      desktopApi: 'runtime.refreshInventory',
      executable: true,
      executionKind: 'harmless_inventory_refresh',
      acceptsRendererCommand: false,
      requiresShell: false,
    });
    expect(registry.handlers['runtime.runHealthCheck']).toMatchObject({
      executable: false,
      status: 'planned_not_implemented',
    });
  });

  it('refreshes inventory through an exact allowlisted handler and records sanitized audit events', async () => {
    const inventory = {
      collectedAt: '2026-05-07T07:45:00.000Z',
      desktopSmoke: { bridgeExpected: true, platformSupported: true, status: 'ready' },
      machine: { platform: 'darwin', arch: 'arm64', osRelease: 'test', hostname: '[redacted]', homeDir: '[redacted]' },
      tools: {},
      services: {},
      agents: {},
      configs: {},
    };
    const collectLocalInventory = vi.fn(async () => inventory);
    const appendRuntimeActionAuditEvents = vi.fn(() => ({ schemaVersion: 1, status: 'ready', events: [], message: 'ok' }));

    const result = await executeAllowlistedRuntimeAction(
      { desktopApi: 'runtime.refreshInventory', source: 'renderer', correlationId: 'corr_refresh_1' },
      { collectLocalInventory, appendRuntimeActionAuditEvents, now: () => '2026-05-07T07:45:01.000Z' },
    );

    expect(collectLocalInventory).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'succeeded',
      desktopApi: 'runtime.refreshInventory',
      correlationId: 'corr_refresh_1',
      rendererCanExecuteArbitraryActions: false,
      executedShell: false,
      inventory,
    });
    expect(appendRuntimeActionAuditEvents).toHaveBeenCalledTimes(1);
    const auditEvents = appendRuntimeActionAuditEvents.mock.calls[0][0];
    expect(auditEvents).toHaveLength(2);
    expect(auditEvents.map((event) => event.eventType)).toEqual(['runtime_action_requested', 'runtime_action_completed']);
    expect(auditEvents.every((event) => event.safeForLog === true)).toBe(true);
    expect(JSON.stringify(auditEvents)).not.toContain('/Users/');
    expect(JSON.stringify(auditEvents)).not.toContain('token');
  });

  it('rejects renderer attempts to execute arbitrary or unimplemented actions', async () => {
    await expect(executeAllowlistedRuntimeAction({
      desktopApi: 'runtime.runHealthCheck',
      source: 'renderer',
    })).rejects.toThrow('No executable allowlisted handler for runtime.runHealthCheck');

    await expect(executeAllowlistedRuntimeAction({
      desktopApi: 'runtime.refreshInventory',
      source: 'renderer',
      command: 'rm -rf /',
    })).rejects.toThrow('Runtime action request cannot include command, args, or shell fields');

    await expect(executeAllowlistedRuntimeAction({
      desktopApi: 'runtime.refreshInventory; rm -rf /',
      source: 'renderer',
    })).rejects.toThrow('Invalid runtime action desktop API');
  });
});
