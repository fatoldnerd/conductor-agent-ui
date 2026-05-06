import { describe, expect, it } from 'vitest';
import type { RuntimeActionApprovalQueueItem } from './runtimeActionApprovalWorkflow';
import {
  buildRuntimeActionApprovalQueuePersistenceContract,
  buildRuntimeActionApprovalQueueReadResult,
  sanitizeRuntimeActionApprovalQueueItemsForPersistence,
  validateRuntimeActionApprovalQueuePersistenceWrite,
} from './runtimeActionApprovalQueuePersistence';

function queueItem(overrides: Partial<RuntimeActionApprovalQueueItem> = {}): RuntimeActionApprovalQueueItem {
  return {
    schemaVersion: 1,
    state: 'awaiting_approval',
    correlationId: 'persist-queue-001',
    runtimeId: 'claude-code',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    desktopApi: 'runtime.runHealthCheck',
    riskLevel: 'low',
    requestedAt: '2026-05-06T13:00:00.000Z',
    requestedSummary: 'Claude Code requested a health check.',
    approvalPrompt: 'Approve Claude Code health check?',
    canApprove: true,
    canReject: true,
    requiresNativeConfirmation: true,
    guardrails: ['Approval only unlocks a named desktop API; no renderer shell execution.'],
    auditPreview: [],
    ...overrides,
  };
}

describe('runtime action approval queue persistence contract', () => {
  it('defines Electron-main-owned queue storage without renderer writes or decisions', () => {
    const contract = buildRuntimeActionApprovalQueuePersistenceContract();

    expect(contract.schemaVersion).toBe(1);
    expect(contract.owner).toBe('electron_main');
    expect(contract.storageKind).toBe('local_jsonl');
    expect(contract.appendMode).toBe('append_only');
    expect(contract.rendererAccess.canRead).toBe(true);
    expect(contract.rendererAccess.canAppend).toBe(false);
    expect(contract.rendererAccess.canApprove).toBe(false);
    expect(contract.rendererAccess.canReject).toBe(false);
    expect(contract.preloadApi.readMethod).toBe('runtimeActions.getApprovalQueue');
    expect(contract.preloadApi.approveMethod).toBeNull();
    expect(contract.preloadApi.rejectMethod).toBeNull();
    expect(contract.storagePathPolicy.exposesAbsolutePathToRenderer).toBe(false);
  });

  it('redacts unsafe queue display strings before persistence', () => {
    const [item] = sanitizeRuntimeActionApprovalQueueItemsForPersistence([
      queueItem({
        requestedSummary: 'Run health check with token=secret from /Users/brad/private',
        approvalPrompt: 'Approve API_KEY=secret for /root/private?',
        guardrails: ['Never expose password=secret or /home/brad/path'],
      }),
    ]);

    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain('token=secret');
    expect(serialized).not.toContain('API_KEY=secret');
    expect(serialized).not.toContain('password=secret');
    expect(serialized).not.toContain('/Users/brad/private');
    expect(serialized).not.toContain('/root/private');
    expect(serialized).not.toContain('/home/brad/path');
    expect(serialized).toContain('[REDACTED]');
  });

  it('rejects queue persistence writes for non-queueable or already decided items', () => {
    const blocked = validateRuntimeActionApprovalQueuePersistenceWrite([
      queueItem({ state: 'blocked', canApprove: false, canReject: false }),
    ]);

    expect(blocked.valid).toBe(false);
    if (blocked.valid) throw new Error('expected blocked item to be rejected');
    expect(blocked.reason).toContain('awaiting_approval');
  });

  it('builds read results without inventing approval requests', () => {
    const empty = buildRuntimeActionApprovalQueueReadResult({ available: true, items: [] });
    const unavailable = buildRuntimeActionApprovalQueueReadResult({ available: false, items: [queueItem()], error: 'raw /Users/brad/private token=secret' });

    expect(empty.status).toBe('empty');
    expect(empty.items).toEqual([]);
    expect(empty.message).toContain('No runtime action approval requests');
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.items).toEqual([]);
    expect(unavailable.message).toContain('approval queue storage is unavailable');
    expect(unavailable.message).not.toContain('/Users/brad/private');
  });
});
