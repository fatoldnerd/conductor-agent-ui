import { describe, expect, it } from 'vitest';
import { buildRuntimeActionExecutionContract, type FutureExecutableRuntimeAction } from './runtimeActionAllowlist';
import {
  applyRuntimeActionApprovalDecision,
  buildRuntimeActionApprovalDecision,
  buildRuntimeActionApprovalQueueItem,
} from './runtimeActionApprovalWorkflow';
import { buildRuntimeActionRequestEnvelope } from './runtimeActionRequestEnvelope';
import { safeAction } from './runtimeReadiness';

const requestedAt = '2026-05-05T20:00:00.000Z';
const decidedAt = '2026-05-05T20:01:00.000Z';

function futureHealthCheckAction(): FutureExecutableRuntimeAction {
  return {
    ...safeAction('health_check'),
    executesCommand: true,
    allowlistedDesktopApi: 'runtime.runHealthCheck',
  };
}

describe('runtime action approval workflow model', () => {
  it('builds an approval queue item for a future allowlisted runtime action', () => {
    const action = futureHealthCheckAction();
    const contract = buildRuntimeActionExecutionContract(action);
    const envelope = buildRuntimeActionRequestEnvelope(action, contract, {
      runtimeId: 'codex-cli',
      source: 'agent-runtimes',
      requestedBy: 'renderer',
      correlationId: 'approval-1',
    });

    const item = buildRuntimeActionApprovalQueueItem({ envelope, requestedAt });

    expect(item).toMatchObject({
      schemaVersion: 1,
      state: 'awaiting_approval',
      correlationId: 'approval-1',
      runtimeId: 'codex-cli',
      actionKind: 'health_check',
      desktopApi: 'runtime.runHealthCheck',
      canApprove: true,
      canReject: true,
      requiresNativeConfirmation: true,
      riskLevel: 'low',
      requestedAt,
      requestedSummary: 'Codex CLI requested health check from Agent Runtimes.',
      approvalPrompt: expect.stringContaining('Approve health check for Codex CLI'),
      guardrails: expect.arrayContaining([
        'Approval only unlocks a named desktop API; it never unlocks renderer shell execution.',
        'A native desktop confirmation is still required before any future execution.',
      ]),
      auditPreview: expect.arrayContaining([
        expect.objectContaining({ eventType: 'request_created', correlationId: 'approval-1' }),
        expect.objectContaining({ eventType: 'approval_required', correlationId: 'approval-1' }),
      ]),
    });
  });

  it('does not queue metadata-only runtime previews for approval', () => {
    const action = safeAction('configure');
    const contract = buildRuntimeActionExecutionContract(action);
    const envelope = buildRuntimeActionRequestEnvelope(action, contract, {
      runtimeId: 'hermes',
      source: 'agent-runtimes',
      requestedBy: 'renderer',
      correlationId: 'metadata-only',
    });

    const item = buildRuntimeActionApprovalQueueItem({ envelope, requestedAt });

    expect(item).toMatchObject({
      state: 'not_queueable',
      canApprove: false,
      canReject: false,
      requiresNativeConfirmation: false,
      desktopApi: null,
      requestedSummary: 'Hermes Agent requested configure from Agent Runtimes.',
      approvalPrompt: 'No approval request is queued because this action is preview metadata only.',
    });
    expect(item.auditPreview.map((event) => event.eventType)).toEqual(['request_created']);
  });

  it('represents blocked requests without allowing approval', () => {
    const action: FutureExecutableRuntimeAction = {
      ...safeAction('preview_install'),
      executesCommand: true,
      allowlistedDesktopApi: 'shell.exec',
    };
    const contract = buildRuntimeActionExecutionContract(action);
    const envelope = buildRuntimeActionRequestEnvelope(action, contract, {
      runtimeId: 'openclaw',
      source: 'agent-runtimes',
      requestedBy: 'renderer',
      correlationId: 'blocked-1',
    });

    const item = buildRuntimeActionApprovalQueueItem({ envelope, requestedAt });

    expect(item).toMatchObject({
      state: 'blocked',
      canApprove: false,
      canReject: false,
      requiresNativeConfirmation: false,
      desktopApi: null,
      approvalPrompt: expect.stringContaining('blocked before approval'),
    });
    expect(item.auditPreview.map((event) => event.eventType)).toEqual(['request_created', 'blocked']);
  });

  it('applies approve, reject, and cancel decisions only to pending approval items', () => {
    const action = futureHealthCheckAction();
    const contract = buildRuntimeActionExecutionContract(action);
    const envelope = buildRuntimeActionRequestEnvelope(action, contract, {
      runtimeId: 'codex-cli',
      source: 'agent-runtimes',
      requestedBy: 'renderer',
      correlationId: 'approval-2',
    });
    const pending = buildRuntimeActionApprovalQueueItem({ envelope, requestedAt });

    const approved = applyRuntimeActionApprovalDecision(
      pending,
      buildRuntimeActionApprovalDecision({ decision: 'approved', decidedAt, decidedBy: 'user', note: 'looks safe' }),
    );
    const rejected = applyRuntimeActionApprovalDecision(
      pending,
      buildRuntimeActionApprovalDecision({ decision: 'rejected', decidedAt, decidedBy: 'user' }),
    );
    const cancelled = applyRuntimeActionApprovalDecision(
      pending,
      buildRuntimeActionApprovalDecision({ decision: 'cancelled', decidedAt, decidedBy: 'system' }),
    );

    expect(approved).toMatchObject({ state: 'approved', canApprove: false, canReject: false, decision: expect.objectContaining({ decision: 'approved', note: 'looks safe' }) });
    expect(rejected).toMatchObject({ state: 'rejected', canApprove: false, canReject: false, decision: expect.objectContaining({ decision: 'rejected' }) });
    expect(cancelled).toMatchObject({ state: 'cancelled', canApprove: false, canReject: false, decision: expect.objectContaining({ decision: 'cancelled' }) });
    expect(approved.auditPreview.map((event) => event.eventType)).toEqual(['request_created', 'approved']);
  });
});
