import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import queueStore from './runtimeActionApprovalQueueStore.cjs';

const {
  appendRuntimeActionApprovalQueueItems,
  readRuntimeActionApprovalQueue,
  setRuntimeActionApprovalQueuePath,
} = queueStore;

const tempDirs = [];

function tempQueuePath() {
  const dir = mkdtempSync(join(tmpdir(), 'conductor-runtime-approval-queue-resolution-'));
  tempDirs.push(dir);
  return join(dir, 'runtime-action-approval-queue.jsonl');
}

function queueItem(overrides = {}) {
  return {
    schemaVersion: 1,
    state: 'awaiting_approval',
    correlationId: 'resolution-queue-001',
    runtimeId: 'codex-cli',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    desktopApi: 'runtime.runHealthCheck',
    riskLevel: 'low',
    requestedAt: '2026-05-06T13:00:00.000Z',
    requestedSummary: 'Codex CLI requested a health check.',
    approvalPrompt: 'Approve Codex CLI health check?',
    canApprove: true,
    canReject: true,
    requiresNativeConfirmation: true,
    guardrails: ['Approval only unlocks a named desktop API; no renderer shell execution.'],
    auditPreview: [],
    ...overrides,
  };
}

function decisionEnvelope(overrides = {}) {
  return {
    schemaVersion: 1,
    state: 'rejected',
    correlationId: 'resolution-queue-001',
    runtimeId: 'codex-cli',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    decision: {
      schemaVersion: 1,
      decision: 'rejected',
      decidedAt: '2026-05-06T13:05:00.000Z',
      decidedBy: 'user',
      safeForLog: true,
    },
    execution: {
      rendererCanExecute: false,
      requiresNativeConfirmation: false,
      desktopApi: null,
      reason: 'Rejected or cancelled decisions are terminal and cannot execute.',
    },
    auditEvents: [],
    ...overrides,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('runtime action approval queue resolution semantics', () => {
  it('filters decided approval requests from the pending queue without deleting stored queue history', () => {
    const queuePath = tempQueuePath();
    setRuntimeActionApprovalQueuePath(queuePath);
    appendRuntimeActionApprovalQueueItems([
      queueItem({ correlationId: 'already-decided', requestedAt: '2026-05-06T13:00:00.000Z' }),
      queueItem({ correlationId: 'still-pending', requestedAt: '2026-05-06T13:01:00.000Z' }),
    ]);

    const result = readRuntimeActionApprovalQueue({
      decisionReadResult: {
        schemaVersion: 1,
        status: 'ready',
        decisions: [decisionEnvelope({ correlationId: 'already-decided' })],
        message: 'Runtime action approval decisions were read from local desktop storage.',
      },
    });

    expect(result.status).toBe('ready');
    expect(result.items.map((item) => item.correlationId)).toEqual(['still-pending']);
    expect(result.pendingItemCount).toBe(1);
    expect(result.resolvedItemCount).toBe(1);
    expect(result.totalItemCount).toBe(2);
    expect(result.message).toContain('pending');
  });

  it('returns an empty pending queue when every stored request has a recorded decision', () => {
    const queuePath = tempQueuePath();
    setRuntimeActionApprovalQueuePath(queuePath);
    appendRuntimeActionApprovalQueueItems([
      queueItem({ correlationId: 'approved-request' }),
      queueItem({ correlationId: 'rejected-request' }),
    ]);

    const result = readRuntimeActionApprovalQueue({
      decisionReadResult: {
        schemaVersion: 1,
        status: 'ready',
        decisions: [
          decisionEnvelope({ correlationId: 'approved-request', state: 'accepted_for_native_confirmation' }),
          decisionEnvelope({ correlationId: 'rejected-request', state: 'rejected' }),
        ],
        message: 'Runtime action approval decisions were read from local desktop storage.',
      },
    });

    expect(result.status).toBe('empty');
    expect(result.items).toEqual([]);
    expect(result.pendingItemCount).toBe(0);
    expect(result.resolvedItemCount).toBe(2);
    expect(result.message).toContain('No pending runtime action approval requests');
    expect(result.message).toContain('2 resolved');
  });

  it('fails closed instead of showing stale pending approvals when decision state is unavailable', () => {
    const queuePath = tempQueuePath();
    setRuntimeActionApprovalQueuePath(queuePath);
    appendRuntimeActionApprovalQueueItems([queueItem()]);

    const result = readRuntimeActionApprovalQueue({
      decisionReadResult: {
        schemaVersion: 1,
        status: 'unavailable',
        decisions: [],
        message: 'Raw decision store failure /Users/brad/private token=secret',
      },
    });

    expect(result.status).toBe('unavailable');
    expect(result.items).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('/Users/brad/private');
    expect(JSON.stringify(result)).not.toContain('token=secret');
  });
});
