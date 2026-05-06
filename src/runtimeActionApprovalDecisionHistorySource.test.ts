import { describe, expect, it } from 'vitest';
import { buildRuntimeActionExecutionContract, type FutureExecutableRuntimeAction } from './runtimeActionAllowlist';
import { buildRuntimeActionApprovalDecision, buildRuntimeActionApprovalQueueItem } from './runtimeActionApprovalWorkflow';
import { buildRuntimeActionDecisionEnvelope, type RuntimeActionApprovalDecisionEnvelope } from './runtimeActionApprovalDecisionEnvelope';
import { buildRuntimeActionApprovalDecisionReadResult } from './runtimeActionApprovalDecisionPersistence';
import { buildRuntimeActionRequestEnvelope } from './runtimeActionRequestEnvelope';
import { safeAction } from './runtimeReadiness';
import {
  buildRuntimeActionApprovalDecisionHistorySourceState,
  normalizeRuntimeActionApprovalDecisionHistorySourceDecisions,
} from './runtimeActionApprovalDecisionHistorySource';

function futureHealthCheckAction(): FutureExecutableRuntimeAction {
  return {
    ...safeAction('health_check'),
    executesCommand: true,
    allowlistedDesktopApi: 'runtime.runHealthCheck',
  };
}

function decisionEnvelope(overrides: {
  correlationId?: string;
  decision?: 'approved' | 'rejected' | 'cancelled';
  decidedAt?: string;
  note?: string;
} = {}): RuntimeActionApprovalDecisionEnvelope {
  const action = futureHealthCheckAction();
  const contract = buildRuntimeActionExecutionContract(action);
  const correlationId = overrides.correlationId ?? 'decision-history-1';
  const envelope = buildRuntimeActionRequestEnvelope(action, contract, {
    runtimeId: 'codex-cli',
    source: 'agent-runtimes',
    requestedBy: 'renderer',
    correlationId,
  });
  const item = buildRuntimeActionApprovalQueueItem({ envelope, requestedAt: '2026-05-06T13:15:00.000Z' });
  return buildRuntimeActionDecisionEnvelope({
    item,
    decision: buildRuntimeActionApprovalDecision({
      decision: overrides.decision ?? 'approved',
      decidedAt: overrides.decidedAt ?? '2026-05-06T13:16:00.000Z',
      decidedBy: 'user',
      ...(overrides.note ? { note: overrides.note } : {}),
    }),
  });
}

describe('runtime action approval decision history source', () => {
  it('represents browser mode as desktop-required without fake decisions', () => {
    const state = buildRuntimeActionApprovalDecisionHistorySourceState({ desktopBridgeAvailable: false });

    expect(state).toMatchObject({
      schemaVersion: 1,
      status: 'desktop_required',
      sourceKind: 'none',
      canRead: false,
      decisions: [],
      viewModel: expect.objectContaining({ empty: true, entries: [] }),
    });
    expect(state.message).toContain('desktop app');
  });

  it('does not invent decisions when desktop mode has no connected source', () => {
    const state = buildRuntimeActionApprovalDecisionHistorySourceState({ desktopBridgeAvailable: true });

    expect(state.status).toBe('not_connected');
    expect(state.canRead).toBe(false);
    expect(state.decisions).toEqual([]);
    expect(state.viewModel.empty).toBe(true);
    expect(state.message).toContain('will not show fake decisions');
  });

  it('adapts read-only decision bridge results into a sorted sanitized view model', () => {
    const older = decisionEnvelope({ correlationId: 'older-decision', decision: 'rejected', decidedAt: '2026-05-06T13:16:00.000Z' });
    const newer = decisionEnvelope({ correlationId: 'newer-decision', decision: 'approved', decidedAt: '2026-05-06T13:18:00.000Z' });
    const result = buildRuntimeActionApprovalDecisionReadResult({ available: true, decisions: [older, newer] });

    const state = buildRuntimeActionApprovalDecisionHistorySourceState({
      desktopBridgeAvailable: true,
      sourceKind: 'electron-local',
      decisions: result,
    });

    expect(state.status).toBe('ready');
    expect(state.canRead).toBe(true);
    expect(state.decisions.map((decision) => decision.correlationId)).toEqual(['older-decision', 'newer-decision']);
    expect(state.viewModel.entries.map((entry) => entry.correlationId)).toEqual(['newer-decision', 'older-decision']);
    expect(state.viewModel.stats).toMatchObject({ total: 2, approved: 1, rejected: 1, cancelled: 0, pendingNativeConfirmation: 1 });
  });

  it('redacts unsafe decision notes before they reach the renderer', () => {
    const normalized = normalizeRuntimeActionApprovalDecisionHistorySourceDecisions([
      decisionEnvelope({ note: 'approved from /Users/brad/private with token=secret' }),
    ]);
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toContain('/Users/brad/private');
    expect(serialized).not.toContain('token=secret');
    expect(serialized).toContain('[REDACTED]');
  });

  it('fails safely on source errors and unavailable read results', () => {
    const sourceError = buildRuntimeActionApprovalDecisionHistorySourceState({
      desktopBridgeAvailable: true,
      sourceKind: 'electron-local',
      error: 'raw path /Users/brad/private token=secret',
    });
    const unavailable = buildRuntimeActionApprovalDecisionHistorySourceState({
      desktopBridgeAvailable: true,
      sourceKind: 'electron-local',
      decisions: { schemaVersion: 1, status: 'unavailable', decisions: [], message: 'raw /Users/brad/private token=secret' },
    });

    expect(sourceError).toMatchObject({ status: 'error', canRead: false, decisions: [] });
    expect(unavailable).toMatchObject({ status: 'error', canRead: false, decisions: [] });
    expect(JSON.stringify(sourceError)).not.toContain('/Users/brad/private');
    expect(JSON.stringify(unavailable)).not.toContain('token=secret');
  });
});
