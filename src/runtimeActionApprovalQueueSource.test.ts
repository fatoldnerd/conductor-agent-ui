import { describe, expect, it } from 'vitest';
import type { RuntimeActionApprovalQueueItem } from './runtimeActionApprovalWorkflow';
import { buildRuntimeActionApprovalQueueSourceState, normalizeRuntimeActionApprovalQueueSourceItems } from './runtimeActionApprovalQueueSource';

function queueItem(overrides: Partial<RuntimeActionApprovalQueueItem> = {}): RuntimeActionApprovalQueueItem {
  return {
    schemaVersion: 1,
    state: 'awaiting_approval',
    correlationId: 'queue-source-1',
    runtimeId: 'codex-cli',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    desktopApi: 'runtime.runHealthCheck',
    riskLevel: 'low',
    requestedAt: '2026-05-06T12:00:00.000Z',
    requestedSummary: 'Codex CLI requested health check from Agent Runtimes.',
    approvalPrompt: 'Approve health check for Codex CLI? Conductor will still require native desktop confirmation before any future execution.',
    canApprove: true,
    canReject: true,
    requiresNativeConfirmation: true,
    guardrails: ['Approval only unlocks a named desktop API; it never unlocks renderer shell execution.'],
    auditPreview: [],
    ...overrides,
  };
}

describe('runtime action approval queue source', () => {
  it('requires the desktop bridge before reading local approval queue state', () => {
    const state = buildRuntimeActionApprovalQueueSourceState({ desktopBridgeAvailable: false });

    expect(state.status).toBe('desktop_required');
    expect(state.sourceKind).toBe('none');
    expect(state.canRead).toBe(false);
    expect(state.items).toEqual([]);
    expect(state.viewModel.empty).toBe(true);
    expect(state.message).toContain('requires the Conductor desktop app');
  });

  it('does not invent approval requests when no source is connected', () => {
    const state = buildRuntimeActionApprovalQueueSourceState({ desktopBridgeAvailable: true });

    expect(state.status).toBe('not_connected');
    expect(state.canRead).toBe(false);
    expect(state.items).toEqual([]);
    expect(state.viewModel.entries).toEqual([]);
    expect(state.message).toContain('will not show fake approvals');
  });

  it('returns a ready empty queue when a trusted source is connected with no items', () => {
    const state = buildRuntimeActionApprovalQueueSourceState({
      desktopBridgeAvailable: true,
      sourceKind: 'electron-local',
      items: [],
    });

    expect(state.status).toBe('ready');
    expect(state.canRead).toBe(true);
    expect(state.viewModel.empty).toBe(true);
    expect(state.viewModel.stats.total).toBe(0);
    expect(state.message).toContain('loaded from a trusted desktop source');
  });

  it('feeds source items into the approval queue view model', () => {
    const state = buildRuntimeActionApprovalQueueSourceState({
      desktopBridgeAvailable: true,
      sourceKind: 'electron-local',
      items: [
        queueItem({ correlationId: 'older', requestedAt: '2026-05-06T11:00:00.000Z' }),
        queueItem({ correlationId: 'newer', requestedAt: '2026-05-06T12:00:00.000Z' }),
      ],
    });

    expect(state.status).toBe('ready');
    expect(state.items).toHaveLength(2);
    expect(state.viewModel.empty).toBe(false);
    expect(state.viewModel.entries.map((entry) => entry.correlationId)).toEqual(['newer', 'older']);
  });

  it('redacts unsafe display strings before queue items reach the view model', () => {
    const items = normalizeRuntimeActionApprovalQueueSourceItems([
      queueItem({
        correlationId: 'unsafe',
        requestedSummary: 'Run command token=secret from /Users/brad/private/path',
        approvalPrompt: 'Approve command with API_KEY=secret?',
        guardrails: ['Do not expose token=secret or private path /Users/brad/private/path'],
      }),
    ]);

    const serialized = JSON.stringify(items);
    expect(serialized).not.toContain('token=secret');
    expect(serialized).not.toContain('API_KEY=secret');
    expect(serialized).not.toContain('/Users/brad/private/path');
    expect(serialized).toContain('[REDACTED]');
  });

  it('fails safely on source errors without exposing details', () => {
    const state = buildRuntimeActionApprovalQueueSourceState({
      desktopBridgeAvailable: true,
      sourceKind: 'electron-local',
      error: 'raw filesystem path /Users/brad/private/path token=secret',
    });

    expect(state.status).toBe('error');
    expect(state.canRead).toBe(false);
    expect(state.items).toEqual([]);
    expect(state.message).toContain('Details were redacted');
    expect(state.message).not.toContain('/Users/brad/private/path');
  });
});
