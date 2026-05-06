import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
  const dir = mkdtempSync(join(tmpdir(), 'conductor-runtime-approval-queue-'));
  tempDirs.push(dir);
  return join(dir, 'runtime-action-approval-queue.jsonl');
}

function queueItem(overrides = {}) {
  return {
    schemaVersion: 1,
    state: 'awaiting_approval',
    correlationId: 'store-queue-001',
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

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('runtime action approval queue main-process store', () => {
  it('returns an empty read result when the approval queue log does not exist', () => {
    setRuntimeActionApprovalQueuePath(tempQueuePath());

    const result = readRuntimeActionApprovalQueue();

    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'empty',
      items: [],
      message: expect.stringContaining('No runtime action approval requests'),
    });
  });

  it('appends sanitized queue items as JSONL and reads them newest-first safe for renderer display', () => {
    const queuePath = tempQueuePath();
    setRuntimeActionApprovalQueuePath(queuePath);

    appendRuntimeActionApprovalQueueItems([
      queueItem({ correlationId: 'older', requestedAt: '2026-05-06T12:00:00.000Z' }),
      queueItem({
        correlationId: 'newer',
        requestedAt: '2026-05-06T13:00:00.000Z',
        requestedSummary: 'Run command with token=secret from /Users/brad/private',
        approvalPrompt: 'Approve API_KEY=secret?',
        guardrails: ['Do not expose /root/private'],
      }),
    ]);

    const raw = readFileSync(queuePath, 'utf8');
    const result = readRuntimeActionApprovalQueue();

    expect(raw).not.toContain('token=secret');
    expect(raw).not.toContain('API_KEY=secret');
    expect(raw).not.toContain('/Users/brad/private');
    expect(raw).not.toContain('/root/private');
    expect(result.status).toBe('ready');
    expect(result.items.map((item) => item.correlationId)).toEqual(['newer', 'older']);
    expect(result.items[0].requestedSummary).toContain('[REDACTED]');
  });

  it('rejects malformed or non-awaiting queue items without exposing storage paths', () => {
    const queuePath = tempQueuePath();
    setRuntimeActionApprovalQueuePath(queuePath);

    expect(() => appendRuntimeActionApprovalQueueItems([{ state: 'blocked' }])).toThrow(/invalid runtime action approval queue item/i);
    expect(() => appendRuntimeActionApprovalQueueItems([queueItem({ state: 'blocked', canApprove: false })])).toThrow(/awaiting_approval/i);

    const result = readRuntimeActionApprovalQueue();
    expect(JSON.stringify(result)).not.toContain(queuePath);
  });

  it('recovers from corrupt JSONL rows without exposing raw parse errors', () => {
    const queuePath = tempQueuePath();
    setRuntimeActionApprovalQueuePath(queuePath);
    appendRuntimeActionApprovalQueueItems([queueItem()]);
    const raw = readFileSync(queuePath, 'utf8');
    queueStore.__unsafeWriteRawForTest(`${raw}{not json containing /Users/brad/private token}\n`);

    const result = readRuntimeActionApprovalQueue();

    expect(result.status).toBe('ready');
    expect(result.items).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('/Users/brad/private');
    expect(JSON.stringify(result)).not.toContain('not json');
  });
});
