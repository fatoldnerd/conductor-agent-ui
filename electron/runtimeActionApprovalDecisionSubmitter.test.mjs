import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import queueStore from './runtimeActionApprovalQueueStore.cjs';
import decisionStore from './runtimeActionApprovalDecisionStore.cjs';
import submitter from './runtimeActionApprovalDecisionSubmitter.cjs';

const { appendRuntimeActionApprovalQueueItems, setRuntimeActionApprovalQueuePath } = queueStore;
const { readRuntimeActionApprovalDecisions, setRuntimeActionApprovalDecisionPath } = decisionStore;
const { setRuntimeActionApprovalDecisionSubmitterPaths, submitRuntimeActionApprovalDecision } = submitter;

function queueItem(overrides = {}) {
  return {
    schemaVersion: 1,
    state: 'awaiting_approval',
    correlationId: 'submit-decision-1',
    runtimeId: 'codex-cli',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    desktopApi: 'runtime.runHealthCheck',
    riskLevel: 'low',
    requestedAt: '2026-05-06T14:20:00.000Z',
    requestedSummary: 'Codex CLI requested health check from Agent Runtimes.',
    approvalPrompt: 'Approve health check for Codex CLI?',
    canApprove: true,
    canReject: true,
    requiresNativeConfirmation: true,
    guardrails: ['Native confirmation remains required before any execution.'],
    auditPreview: [
      {
        schemaVersion: 1,
        eventType: 'request_created',
        occurredAt: '2026-05-06T14:20:00.000Z',
        correlationId: 'submit-decision-1',
        runtimeId: 'codex-cli',
        actionKind: 'health_check',
        source: 'agent-runtimes',
        payloadSummary: 'health check requested',
        reason: 'queued for approval',
        safeForLog: true,
        redactedFields: [],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'conductor-decision-submit-'));
  const queuePath = path.join(dir, 'queue.jsonl');
  const decisionPath = path.join(dir, 'decisions.jsonl');
  setRuntimeActionApprovalQueuePath(queuePath);
  setRuntimeActionApprovalDecisionPath(decisionPath);
  setRuntimeActionApprovalDecisionSubmitterPaths({ queuePath, decisionPath });
});

describe('runtime action approval decision submitter', () => {
  it('accepts an approved decision from an existing queue item without executing it', () => {
    appendRuntimeActionApprovalQueueItems([queueItem()]);

    const result = submitRuntimeActionApprovalDecision({
      correlationId: 'submit-decision-1',
      decision: 'approved',
      decidedAt: '2026-05-06T14:21:00.000Z',
      note: 'Approved after checking /Users/brad/private token=secret',
    });

    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'accepted_for_native_confirmation',
      correlationId: 'submit-decision-1',
      execution: {
        rendererCanExecute: false,
        requiresNativeConfirmation: true,
        desktopApi: 'runtime.runHealthCheck',
      },
      nativeConfirmation: {
        required: true,
        implemented: false,
      },
    });

    const decisions = readRuntimeActionApprovalDecisions();
    expect(decisions.status).toBe('ready');
    expect(decisions.decisions[0]).toMatchObject({
      state: 'accepted_for_native_confirmation',
      decision: { decision: 'approved', safeForLog: true },
      execution: { rendererCanExecute: false, requiresNativeConfirmation: true },
    });
    expect(JSON.stringify(decisions)).not.toContain('/Users/brad/private');
    expect(JSON.stringify(decisions)).not.toContain('token=secret');
  });

  it('accepts rejected decisions as terminal and non-executable', () => {
    appendRuntimeActionApprovalQueueItems([queueItem({ correlationId: 'reject-me' })]);

    const result = submitRuntimeActionApprovalDecision({
      correlationId: 'reject-me',
      decision: 'rejected',
      decidedAt: '2026-05-06T14:22:00.000Z',
      note: 'Not safe enough',
    });

    expect(result.status).toBe('rejected');
    expect(result.execution).toMatchObject({
      rendererCanExecute: false,
      requiresNativeConfirmation: false,
      desktopApi: null,
    });
    expect(result.nativeConfirmation.required).toBe(false);
  });

  it('fails closed for unknown, duplicate, malformed, or non-awaiting decisions', () => {
    appendRuntimeActionApprovalQueueItems([queueItem({ correlationId: 'known' })]);
    submitRuntimeActionApprovalDecision({ correlationId: 'known', decision: 'rejected', decidedAt: '2026-05-06T14:22:00.000Z' });

    expect(() => submitRuntimeActionApprovalDecision({ correlationId: 'missing', decision: 'approved' })).toThrow(/No pending approval queue item/);
    expect(() => submitRuntimeActionApprovalDecision({ correlationId: 'known', decision: 'approved' })).toThrow(/already has a recorded decision/);
    expect(() => submitRuntimeActionApprovalDecision({ correlationId: '../bad', decision: 'approved' })).toThrow(/Invalid runtime action correlation id/);
    expect(() => submitRuntimeActionApprovalDecision({ correlationId: 'known', decision: 'execute' })).toThrow(/Invalid approval decision/);
  });
});
