import { describe, expect, it } from 'vitest';
import { buildRuntimeActionExecutionContract, type FutureExecutableRuntimeAction } from './runtimeActionAllowlist';
import { buildRuntimeActionApprovalDecision, buildRuntimeActionApprovalQueueItem } from './runtimeActionApprovalWorkflow';
import { buildRuntimeActionDecisionEnvelope, validateRuntimeActionDecisionEnvelopeForSubmit } from './runtimeActionApprovalDecisionEnvelope';
import { buildRuntimeActionRequestEnvelope } from './runtimeActionRequestEnvelope';
import { safeAction } from './runtimeReadiness';

const requestedAt = '2026-05-06T13:15:00.000Z';
const decidedAt = '2026-05-06T13:16:00.000Z';

function futureHealthCheckAction(): FutureExecutableRuntimeAction {
  return {
    ...safeAction('health_check'),
    executesCommand: true,
    allowlistedDesktopApi: 'runtime.runHealthCheck',
  };
}

function pendingQueueItem() {
  const action = futureHealthCheckAction();
  const contract = buildRuntimeActionExecutionContract(action);
  const envelope = buildRuntimeActionRequestEnvelope(action, contract, {
    runtimeId: 'codex-cli',
    source: 'agent-runtimes',
    requestedBy: 'renderer',
    correlationId: 'decision-envelope-1',
  });
  return buildRuntimeActionApprovalQueueItem({ envelope, requestedAt });
}

describe('runtime action approval decision envelope', () => {
  it('wraps an approval decision without making it executable from the renderer', () => {
    const envelope = buildRuntimeActionDecisionEnvelope({
      item: pendingQueueItem(),
      decision: buildRuntimeActionApprovalDecision({
        decision: 'approved',
        decidedAt,
        decidedBy: 'user',
        note: 'Looks safe, but token=secret and /Users/brad/private should not leak.',
      }),
    });

    expect(envelope).toMatchObject({
      schemaVersion: 1,
      state: 'accepted_for_native_confirmation',
      correlationId: 'decision-envelope-1',
      decision: expect.objectContaining({ decision: 'approved', safeForLog: true }),
      execution: {
        rendererCanExecute: false,
        requiresNativeConfirmation: true,
        desktopApi: 'runtime.runHealthCheck',
      },
    });
    expect(envelope.auditEvents.map((event) => event.eventType)).toEqual(['request_created', 'approved']);
    expect(JSON.stringify(envelope)).not.toContain('token=secret');
    expect(JSON.stringify(envelope)).not.toContain('/Users/brad/private');
  });

  it('turns rejected decisions into terminal non-executable envelopes', () => {
    const envelope = buildRuntimeActionDecisionEnvelope({
      item: pendingQueueItem(),
      decision: buildRuntimeActionApprovalDecision({ decision: 'rejected', decidedAt, decidedBy: 'user' }),
    });

    expect(envelope.state).toBe('rejected');
    expect(envelope.execution.rendererCanExecute).toBe(false);
    expect(envelope.execution.requiresNativeConfirmation).toBe(false);
    expect(envelope.auditEvents.map((event) => event.eventType)).toEqual(['request_created', 'cancelled']);
  });

  it('refuses decisions for blocked or non-queueable items', () => {
    const action = safeAction('configure');
    const contract = buildRuntimeActionExecutionContract(action);
    const request = buildRuntimeActionRequestEnvelope(action, contract, {
      runtimeId: 'hermes',
      source: 'agent-runtimes',
      requestedBy: 'renderer',
      correlationId: 'not-queueable-decision',
    });
    const item = buildRuntimeActionApprovalQueueItem({ envelope: request, requestedAt });

    const envelope = buildRuntimeActionDecisionEnvelope({
      item,
      decision: buildRuntimeActionApprovalDecision({ decision: 'approved', decidedAt, decidedBy: 'user' }),
    });

    expect(envelope.state).toBe('invalid');
    expect(envelope.execution.rendererCanExecute).toBe(false);
    expect(envelope.auditEvents).toEqual([]);
  });

  it('validates submit readiness without creating an approve/reject IPC contract', () => {
    const approved = buildRuntimeActionDecisionEnvelope({
      item: pendingQueueItem(),
      decision: buildRuntimeActionApprovalDecision({ decision: 'approved', decidedAt, decidedBy: 'user' }),
    });
    const rejected = buildRuntimeActionDecisionEnvelope({
      item: pendingQueueItem(),
      decision: buildRuntimeActionApprovalDecision({ decision: 'rejected', decidedAt, decidedBy: 'user' }),
    });

    expect(validateRuntimeActionDecisionEnvelopeForSubmit(approved)).toEqual({
      valid: true,
      reason: 'Approved decisions require native desktop confirmation before any execution can begin.',
    });
    expect(validateRuntimeActionDecisionEnvelopeForSubmit(rejected)).toEqual({
      valid: false,
      reason: 'Only approved decision envelopes can continue to native confirmation.',
    });
  });
});
