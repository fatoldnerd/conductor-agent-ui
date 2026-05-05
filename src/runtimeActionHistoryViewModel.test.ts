import { describe, expect, it } from 'vitest';
import { buildRuntimeActionAuditEvent, type RuntimeActionAuditEvent } from './runtimeActionAuditLog';
import { buildRuntimeActionExecutionContract, type FutureExecutableRuntimeAction } from './runtimeActionAllowlist';
import { buildRuntimeActionRequestEnvelope } from './runtimeActionRequestEnvelope';
import {
  buildRuntimeActionHistoryViewModel,
  summarizeRuntimeActionHistory,
} from './runtimeActionHistoryViewModel';
import { safeAction } from './runtimeReadiness';

function futureHealthCheck(): FutureExecutableRuntimeAction {
  return {
    ...safeAction('health_check'),
    executesCommand: true,
    allowlistedDesktopApi: 'runtime.runHealthCheck',
  };
}

function auditEvent(overrides: Partial<RuntimeActionAuditEvent> = {}): RuntimeActionAuditEvent {
  const action = futureHealthCheck();
  const contract = buildRuntimeActionExecutionContract(action);
  const envelope = buildRuntimeActionRequestEnvelope(action, contract, {
    runtimeId: 'codex-cli',
    source: 'agent-runtimes',
    requestedBy: 'renderer',
    correlationId: 'run-1',
  });
  return {
    ...buildRuntimeActionAuditEvent({
      envelope,
      eventType: 'request_created',
      occurredAt: '2026-05-05T20:00:00.000Z',
    }),
    ...overrides,
  };
}

describe('runtime action history view model', () => {
  it('returns a truthful empty state without sample activity', () => {
    const view = buildRuntimeActionHistoryViewModel([]);

    expect(view).toMatchObject({
      schemaVersion: 1,
      empty: true,
      emptyTitle: 'No runtime action history yet',
      emptyBody: expect.stringContaining('No sample or synthetic activity is shown'),
      entries: [],
      stats: {
        total: 0,
        pendingApproval: 0,
        blocked: 0,
        completed: 0,
        failedOrCancelled: 0,
      },
    });
  });

  it('groups audit events by correlation id into newest-first history entries', () => {
    const events = [
      auditEvent({ correlationId: 'older', occurredAt: '2026-05-05T19:00:00.000Z', eventType: 'request_created', outcome: 'recorded' }),
      auditEvent({ correlationId: 'run-1', occurredAt: '2026-05-05T20:00:00.000Z', eventType: 'request_created', outcome: 'recorded' }),
      auditEvent({ correlationId: 'run-1', occurredAt: '2026-05-05T20:01:00.000Z', eventType: 'approval_required', outcome: 'approval_required' }),
      auditEvent({ correlationId: 'run-1', occurredAt: '2026-05-05T20:02:00.000Z', eventType: 'approved', outcome: 'approved' }),
    ];

    const view = buildRuntimeActionHistoryViewModel(events);

    expect(view.empty).toBe(false);
    expect(view.entries.map((entry) => entry.correlationId)).toEqual(['run-1', 'older']);
    expect(view.entries[0]).toMatchObject({
      runtimeLabel: 'Codex CLI',
      actionLabel: 'health check',
      sourceLabel: 'Agent Runtimes',
      state: 'approved',
      tone: 'ok',
      title: 'Codex CLI health check',
      subtitle: 'Approved and waiting for trusted desktop execution.',
      eventCount: 3,
      latestAt: '2026-05-05T20:02:00.000Z',
      timeline: [
        expect.objectContaining({ eventType: 'request_created', label: 'Request created' }),
        expect.objectContaining({ eventType: 'approval_required', label: 'Approval required' }),
        expect.objectContaining({ eventType: 'approved', label: 'Approved' }),
      ],
    });
  });

  it('classifies blocked, pending, completed, failed, and cancelled entries for dashboards', () => {
    const events = [
      auditEvent({ correlationId: 'pending', eventType: 'approval_required', outcome: 'approval_required' }),
      auditEvent({ correlationId: 'blocked', eventType: 'blocked', outcome: 'blocked' }),
      auditEvent({ correlationId: 'done', eventType: 'completed', outcome: 'completed', resultStatus: 'completed' }),
      auditEvent({ correlationId: 'failed', eventType: 'failed', outcome: 'failed', resultStatus: 'failed' }),
      auditEvent({ correlationId: 'cancelled', eventType: 'cancelled', outcome: 'cancelled', resultStatus: 'cancelled' }),
    ];

    const view = buildRuntimeActionHistoryViewModel(events);

    expect(summarizeRuntimeActionHistory(view.entries)).toEqual({
      total: 5,
      pendingApproval: 1,
      blocked: 1,
      completed: 1,
      failedOrCancelled: 2,
    });
    expect(view.entries.find((entry) => entry.correlationId === 'blocked')).toMatchObject({ state: 'blocked', tone: 'danger' });
    expect(view.entries.find((entry) => entry.correlationId === 'pending')).toMatchObject({ state: 'pending_approval', tone: 'warn' });
    expect(view.entries.find((entry) => entry.correlationId === 'done')).toMatchObject({ state: 'completed', tone: 'ok' });
  });

  it('only exposes sanitized audit fields in display rows', () => {
    const view = buildRuntimeActionHistoryViewModel([
      auditEvent({
        reason: '[redacted]',
        payloadSummary: '[redacted]',
        resultMessage: '[redacted]',
        redactedFields: ['reason', 'payloadSummary', 'resultMessage'],
      }),
    ]);

    expect(view.entries[0].timeline[0]).toMatchObject({
      detail: '[redacted]',
      redactedFields: ['reason', 'payloadSummary', 'resultMessage'],
    });
    expect(JSON.stringify(view)).not.toContain('/Users/');
    expect(JSON.stringify(view)).not.toContain('bash -lc');
    expect(JSON.stringify(view)).not.toContain('token');
  });
});
