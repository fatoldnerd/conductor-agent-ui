import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import decisionStore from './runtimeActionApprovalDecisionStore.cjs';

const {
  appendRuntimeActionApprovalDecisionEnvelopes,
  readRuntimeActionApprovalDecisions,
  setRuntimeActionApprovalDecisionPath,
} = decisionStore;

const tempDirs = [];

function tempDecisionPath() {
  const dir = mkdtempSync(join(tmpdir(), 'conductor-runtime-approval-decisions-'));
  tempDirs.push(dir);
  return join(dir, 'runtime-action-approval-decisions.jsonl');
}

function decisionEnvelope(overrides = {}) {
  return {
    schemaVersion: 1,
    state: 'accepted_for_native_confirmation',
    correlationId: 'decision-store-001',
    runtimeId: 'codex-cli',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    decision: {
      schemaVersion: 1,
      decision: 'approved',
      decidedAt: '2026-05-06T13:31:00.000Z',
      decidedBy: 'user',
      note: 'Approved with token=secret and /Users/brad/private hidden.',
      safeForLog: true,
    },
    execution: {
      rendererCanExecute: false,
      requiresNativeConfirmation: true,
      desktopApi: 'runtime.runHealthCheck',
      reason: 'Approved decisions require native desktop confirmation before any execution can begin.',
    },
    auditEvents: [
      {
        schemaVersion: 1,
        eventType: 'approved',
        occurredAt: '2026-05-06T13:31:00.000Z',
        correlationId: 'decision-store-001',
        runtimeId: 'codex-cli',
        actionKind: 'health_check',
        source: 'agent-runtimes',
        submitState: 'pending_approval',
        desktopApi: 'runtime.runHealthCheck',
        outcome: 'approved',
        payloadSummary: 'codex-cli:health_check',
        safeForLog: true,
        redactedFields: [],
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('runtime action approval decision main-process store', () => {
  it('returns an empty read result when the decision log does not exist', () => {
    setRuntimeActionApprovalDecisionPath(tempDecisionPath());

    const result = readRuntimeActionApprovalDecisions();

    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'empty',
      decisions: [],
      message: expect.stringContaining('No runtime action approval decisions'),
    });
  });

  it('appends sanitized decision envelopes as JSONL and reads them newest-first safe for renderer display', () => {
    const decisionPath = tempDecisionPath();
    setRuntimeActionApprovalDecisionPath(decisionPath);

    appendRuntimeActionApprovalDecisionEnvelopes([
      decisionEnvelope({ correlationId: 'older', decision: { ...decisionEnvelope().decision, decidedAt: '2026-05-06T13:00:00.000Z', note: 'older' } }),
      decisionEnvelope({ correlationId: 'newer', decision: { ...decisionEnvelope().decision, decidedAt: '2026-05-06T14:00:00.000Z' } }),
    ]);

    const raw = readFileSync(decisionPath, 'utf8');
    const result = readRuntimeActionApprovalDecisions();

    expect(raw).not.toContain('token=secret');
    expect(raw).not.toContain('/Users/brad/private');
    expect(result.status).toBe('ready');
    expect(result.decisions.map((item) => item.correlationId)).toEqual(['newer', 'older']);
    expect(result.decisions[0].decision.note).toContain('[REDACTED]');
  });

  it('rejects malformed or executable decision envelopes without exposing storage paths', () => {
    const decisionPath = tempDecisionPath();
    setRuntimeActionApprovalDecisionPath(decisionPath);

    expect(() => appendRuntimeActionApprovalDecisionEnvelopes([{ state: 'accepted_for_native_confirmation' }])).toThrow(/invalid runtime action approval decision envelope/i);
    expect(() => appendRuntimeActionApprovalDecisionEnvelopes([
      decisionEnvelope({ execution: { ...decisionEnvelope().execution, rendererCanExecute: true } }),
    ])).toThrow(/renderer execution/i);

    const result = readRuntimeActionApprovalDecisions();
    expect(JSON.stringify(result)).not.toContain(decisionPath);
  });

  it('recovers from corrupt JSONL rows without exposing raw parse errors', () => {
    const decisionPath = tempDecisionPath();
    setRuntimeActionApprovalDecisionPath(decisionPath);
    appendRuntimeActionApprovalDecisionEnvelopes([decisionEnvelope()]);
    const raw = readFileSync(decisionPath, 'utf8');
    decisionStore.__unsafeWriteRawForTest(`${raw}{not json containing /Users/brad/private token}\n`);

    const result = readRuntimeActionApprovalDecisions();

    expect(result.status).toBe('ready');
    expect(result.decisions).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('/Users/brad/private');
    expect(JSON.stringify(result)).not.toContain('not json');
  });
});
