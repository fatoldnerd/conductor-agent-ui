import { describe, expect, it } from 'vitest';
import { buildRuntimeActionAuditEvent } from './runtimeActionAuditLog';
import { buildRuntimeActionAuditPersistenceReadResult } from './runtimeActionAuditPersistence';
import { buildRuntimeActionExecutionContract, type FutureExecutableRuntimeAction } from './runtimeActionAllowlist';
import { buildRuntimeActionHistorySourceState, normalizeRuntimeActionHistorySourceEvents } from './runtimeActionHistorySource';
import { buildRuntimeActionRequestEnvelope } from './runtimeActionRequestEnvelope';
import { safeAction } from './runtimeReadiness';

function futureHealthCheck(): FutureExecutableRuntimeAction {
  return {
    ...safeAction('health_check'),
    executesCommand: true,
    allowlistedDesktopApi: 'runtime.runHealthCheck',
  };
}

function auditEvent(overrides = {}) {
  const action = futureHealthCheck();
  const contract = buildRuntimeActionExecutionContract(action);
  const envelope = buildRuntimeActionRequestEnvelope(action, contract, {
    runtimeId: 'codex-cli',
    source: 'agent-runtimes',
    requestedBy: 'renderer',
    correlationId: 'history-source-1',
  });
  return {
    ...buildRuntimeActionAuditEvent({
      envelope,
      eventType: 'request_created',
      occurredAt: '2026-05-05T21:15:00.000Z',
    }),
    ...overrides,
  };
}

describe('runtime action history source contract', () => {
  it('represents browser mode as unavailable without inventing activity', () => {
    const state = buildRuntimeActionHistorySourceState({ desktopBridgeAvailable: false });

    expect(state).toMatchObject({
      schemaVersion: 1,
      status: 'desktop_required',
      sourceKind: 'none',
      canRead: false,
      events: [],
      message: expect.stringContaining('desktop app'),
      viewModel: expect.objectContaining({ empty: true, entries: [] }),
    });
  });

  it('represents desktop mode without a connected source as read-only empty', () => {
    const state = buildRuntimeActionHistorySourceState({ desktopBridgeAvailable: true });

    expect(state).toMatchObject({
      status: 'not_connected',
      sourceKind: 'none',
      canRead: false,
      events: [],
      message: expect.stringContaining('No runtime action history source is connected yet'),
      viewModel: expect.objectContaining({ empty: true, entries: [] }),
    });
  });

  it('accepts sanitized Electron/local audit events and builds the history view model', () => {
    const state = buildRuntimeActionHistorySourceState({
      desktopBridgeAvailable: true,
      sourceKind: 'electron-local',
      events: [auditEvent()],
    });

    expect(state).toMatchObject({
      status: 'ready',
      sourceKind: 'electron-local',
      canRead: true,
      message: 'Runtime action history is loaded from a trusted desktop source.',
      viewModel: expect.objectContaining({
        empty: false,
        stats: expect.objectContaining({ total: 1 }),
        entries: [expect.objectContaining({ correlationId: 'history-source-1' })],
      }),
    });
  });

  it('normalizes unsafe or non-log-safe events before they reach the renderer', () => {
    const unsafe = auditEvent({
      reason: 'token from /Users/private should not show',
      payloadSummary: 'bash -lc npm install',
      safeForLog: false,
    });

    const events = normalizeRuntimeActionHistorySourceEvents([unsafe]);
    const rendered = JSON.stringify(events);

    expect(events[0]).toMatchObject({
      safeForLog: true,
      reason: '[redacted]',
      payloadSummary: '[redacted]',
      redactedFields: expect.arrayContaining(['reason', 'payloadSummary']),
    });
    expect(rendered).not.toContain('/Users/');
    expect(rendered).not.toContain('bash -lc');
    expect(rendered).not.toContain('token');
  });

  it('reports source errors without exposing raw details or fake events', () => {
    const state = buildRuntimeActionHistorySourceState({
      desktopBridgeAvailable: true,
      sourceKind: 'electron-local',
      error: 'failed reading /Users/private/audit.log token=secret',
    });

    expect(state).toMatchObject({
      status: 'error',
      canRead: false,
      events: [],
      message: 'Runtime action history source is unavailable. Details were redacted for display.',
      viewModel: expect.objectContaining({ empty: true }),
    });
    expect(JSON.stringify(state)).not.toContain('/Users/');
    expect(JSON.stringify(state)).not.toContain('token=secret');
  });

  it('can be driven by the audit persistence read contract without exposing storage details', () => {
    const persistence = buildRuntimeActionAuditPersistenceReadResult({
      available: true,
      events: [auditEvent({ reason: 'command bash -lc should be removed', safeForLog: false })],
    });
    const state = buildRuntimeActionHistorySourceState({
      desktopBridgeAvailable: true,
      sourceKind: 'electron-local',
      persistence,
    });

    expect(state.status).toBe('ready');
    expect(state.events).toHaveLength(1);
    expect(state.events[0].reason).toBe('[redacted]');
    expect(JSON.stringify(state)).not.toContain('bash -lc');
  });
});
