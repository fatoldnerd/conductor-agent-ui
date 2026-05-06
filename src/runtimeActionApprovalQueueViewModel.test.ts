import { describe, expect, it } from 'vitest';
import type { RuntimeActionApprovalQueueItem } from './runtimeActionApprovalWorkflow';
import { buildRuntimeActionApprovalQueueViewModel } from './runtimeActionApprovalQueueViewModel';

function queueItem(overrides: Partial<RuntimeActionApprovalQueueItem> = {}): RuntimeActionApprovalQueueItem {
  return {
    schemaVersion: 1,
    state: 'awaiting_approval',
    correlationId: 'approval-ui-1',
    runtimeId: 'codex-cli',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    desktopApi: 'runtime.runHealthCheck',
    riskLevel: 'low',
    requestedAt: '2026-05-05T20:00:00.000Z',
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

describe('runtime action approval queue view model', () => {
  it('renders a truthful empty approval queue without fake requests', () => {
    const view = buildRuntimeActionApprovalQueueViewModel([]);

    expect(view.empty).toBe(true);
    expect(view.entries).toEqual([]);
    expect(view.emptyTitle).toContain('No runtime actions are awaiting approval');
    expect(view.emptyBody).toContain('No fake approval requests are shown');
    expect(view.stats.awaitingApproval).toBe(0);
  });

  it('shows only awaiting approval items as decisionable queue entries', () => {
    const view = buildRuntimeActionApprovalQueueViewModel([
      queueItem({ correlationId: 'pending', state: 'awaiting_approval' }),
      queueItem({ correlationId: 'blocked', state: 'blocked', canApprove: false, canReject: false }),
      queueItem({ correlationId: 'metadata', state: 'not_queueable', canApprove: false, canReject: false }),
    ]);

    expect(view.empty).toBe(false);
    expect(view.entries.map((entry) => entry.correlationId)).toEqual(['pending']);
    expect(view.stats.awaitingApproval).toBe(1);
    expect(view.stats.blocked).toBe(1);
    expect(view.stats.notQueueable).toBe(1);
    expect(view.entries[0]).toMatchObject({
      title: 'Approve health check for Codex CLI?',
      riskLabel: 'low risk',
      canApprove: true,
      canReject: true,
      requiresNativeConfirmation: true,
      safetyNote: expect.stringContaining('native desktop confirmation'),
    });
  });

  it('sorts awaiting approvals newest first and preserves guardrails', () => {
    const view = buildRuntimeActionApprovalQueueViewModel([
      queueItem({ correlationId: 'older', requestedAt: '2026-05-05T19:00:00.000Z' }),
      queueItem({ correlationId: 'newer', requestedAt: '2026-05-05T21:00:00.000Z', riskLevel: 'medium' }),
    ]);

    expect(view.entries.map((entry) => entry.correlationId)).toEqual(['newer', 'older']);
    expect(view.entries[0].riskLabel).toBe('medium risk');
    expect(view.entries[0].guardrails).toEqual(expect.arrayContaining([
      'Approval only unlocks a named desktop API; it never unlocks renderer shell execution.',
    ]));
  });
});
