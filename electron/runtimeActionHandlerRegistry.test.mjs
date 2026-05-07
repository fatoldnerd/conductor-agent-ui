import { describe, expect, it, vi } from 'vitest';
import {
  executeAllowlistedRuntimeAction,
  listRuntimeActionHandlerRegistry,
} from './runtimeActionHandlerRegistry.cjs';

describe('runtime action handler registry', () => {
  it('registers only explicitly implemented safe handlers as executable', () => {
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
    expect(registry.handlers['runtime.openDocumentation']).toMatchObject({
      desktopApi: 'runtime.openDocumentation',
      executable: true,
      executionKind: 'harmless_open_https_documentation',
      acceptsRendererCommand: false,
      requiresShell: false,
    });
    expect(registry.handlers['runtime.runHealthCheck']).toMatchObject({
      desktopApi: 'runtime.runHealthCheck',
      executable: true,
      executionKind: 'constrained_health_check',
      acceptsRendererCommand: false,
      requiresShell: false,
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

  it('opens documentation through exact recipe ids and controlled HTTPS URLs', async () => {
    const openExternal = vi.fn(async () => undefined);
    const appendRuntimeActionAuditEvents = vi.fn(() => ({ schemaVersion: 1, status: 'ready', events: [], message: 'ok' }));
    const listIntegrationRecipes = vi.fn(() => [
      { id: 'codex-cli', docsUrl: 'https://github.com/openai/codex' },
      { id: 'bad-docs', docsUrl: 'file:///Users/brad/secrets.txt' },
    ]);

    const result = await executeAllowlistedRuntimeAction(
      { desktopApi: 'runtime.openDocumentation', docsTarget: 'codex-cli', source: 'renderer', correlationId: 'corr_docs_1' },
      { openExternal, appendRuntimeActionAuditEvents, listIntegrationRecipes, now: () => '2026-05-07T09:10:00.000Z' },
    );

    expect(openExternal).toHaveBeenCalledWith('https://github.com/openai/codex');
    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'succeeded',
      desktopApi: 'runtime.openDocumentation',
      docsTarget: 'codex-cli',
      openedUrl: 'https://github.com/openai/codex',
      executedShell: false,
      rendererCanExecuteArbitraryActions: false,
    });
    expect(appendRuntimeActionAuditEvents).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(appendRuntimeActionAuditEvents.mock.calls[0][0])).not.toContain('/Users/');

    await expect(executeAllowlistedRuntimeAction(
      { desktopApi: 'runtime.openDocumentation', docsTarget: 'bad-docs', source: 'renderer' },
      { openExternal, appendRuntimeActionAuditEvents, listIntegrationRecipes },
    )).rejects.toThrow('Documentation URL is not an allowlisted HTTPS URL');
  });

  it('runs only the constrained Hermes version health check without shell execution', async () => {
    const execFile = vi.fn(async (command, args, options) => {
      expect(command).toBe('hermes');
      expect(args).toEqual(['--version']);
      expect(options).toMatchObject({ shell: false, timeout: 5000 });
      return { stdout: 'hermes 0.8.0\n', stderr: '' };
    });
    const appendRuntimeActionAuditEvents = vi.fn(() => ({ schemaVersion: 1, status: 'ready', events: [], message: 'ok' }));

    const result = await executeAllowlistedRuntimeAction({
      desktopApi: 'runtime.runHealthCheck',
      runtimeId: 'hermes-agent',
      healthCheckId: 'hermes-version',
      source: 'renderer',
      correlationId: 'corr_health_1',
    }, {
      execFile,
      appendRuntimeActionAuditEvents,
      now: () => '2026-05-07T09:35:00.000Z',
    });

    expect(execFile).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'succeeded',
      desktopApi: 'runtime.runHealthCheck',
      runtimeId: 'hermes-agent',
      healthCheckId: 'hermes-version',
      commandLabel: 'hermes --version',
      executedShell: false,
      rendererCanExecuteArbitraryActions: false,
      stdoutPreview: 'hermes 0.8.0',
    });
    expect(appendRuntimeActionAuditEvents).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(appendRuntimeActionAuditEvents.mock.calls[0][0])).not.toContain('/root/');
  });

  it('rejects health checks outside the exact Electron-main allowlist', async () => {
    await expect(executeAllowlistedRuntimeAction({
      desktopApi: 'runtime.runHealthCheck',
      runtimeId: 'codex-cli',
      healthCheckId: 'codex-version',
      source: 'renderer',
      correlationId: 'corr_health_2',
    }, {
      execFile: async () => { throw new Error('should not execute'); },
      appendRuntimeActionAuditEvents: () => ({ schemaVersion: 1, status: 'ready', events: [], message: 'ok' }),
    })).rejects.toThrow('Health check is not implemented in the exact allowlist');
  });

  it('rejects renderer attempts to execute arbitrary actions', async () => {
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
