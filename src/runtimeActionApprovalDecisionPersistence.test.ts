import { describe, expect, it } from 'vitest';
import { buildRuntimeActionExecutionContract, type FutureExecutableRuntimeAction } from './runtimeActionAllowlist';
import { buildRuntimeActionDecisionEnvelope, type RuntimeActionApprovalDecisionEnvelope } from './runtimeActionApprovalDecisionEnvelope';
import { buildRuntimeActionApprovalDecision, buildRuntimeActionApprovalQueueItem } from './runtimeActionApprovalWorkflow';
import {
  buildRuntimeActionApprovalDecisionPersistenceContract,
  buildRuntimeActionApprovalDecisionReadResult,
  sanitizeRuntimeActionApprovalDecisionEnvelopesForPersistence,
  validateRuntimeActionApprovalDecisionPersistenceWrite,
} from './runtimeActionApprovalDecisionPersistence';
import { buildRuntimeActionRequestEnvelope } from './runtimeActionRequestEnvelope';
import { safeAction } from './runtimeReadiness';

const requestedAt = '2026-05-06T13:30:00.000Z';
const decidedAt = '2026-05-06T13:31:00.000Z';

function futureHealthCheckAction(): FutureExecutableRuntimeAction {
  return {
    ...safeAction('health_check'),
    executesCommand: true,
    allowlistedDesktopApi: 'runtime.runHealthCheck',
  };
}

function decisionEnvelope(overrides: Partial<RuntimeActionApprovalDecisionEnvelope> = {}): RuntimeActionApprovalDecisionEnvelope {
  const action = futureHealthCheckAction();
  const contract = buildRuntimeActionExecutionContract(action);
  const request = buildRuntimeActionRequestEnvelope(action, contract, {
    runtimeId: 'codex-cli',
    source: 'agent-runtimes',
    requestedBy: 'renderer',
    correlationId: 'decision-persist-1',
  });
  const item = buildRuntimeActionApprovalQueueItem({ envelope: request, requestedAt });
  const envelope = buildRuntimeActionDecisionEnvelope({
    item,
    decision: buildRuntimeActionApprovalDecision({
      decision: 'approved',
      decidedAt,
      decidedBy: 'user',
      note: 'Approved with token=secret and /Users/brad/private hidden.',
    }),
  });
  return { ...envelope, ...overrides };
}

describe('runtime action approval decision persistence contract', () => {
  it('defines Electron-main-owned decision storage without renderer writes or execution', () => {
    const contract = buildRuntimeActionApprovalDecisionPersistenceContract();

    expect(contract.schemaVersion).toBe(1);
    expect(contract.owner).toBe('electron_main');
    expect(contract.storageKind).toBe('local_jsonl');
    expect(contract.appendMode).toBe('append_only');
    expect(contract.rendererAccess.canRead).toBe(true);
    expect(contract.rendererAccess.canAppend).toBe(false);
    expect(contract.rendererAccess.canMutate).toBe(false);
    expect(contract.rendererAccess.canExecute).toBe(false);
    expect(contract.preloadApi.readMethod).toBe('runtimeActions.getApprovalDecisions');
    expect(contract.preloadApi.appendMethod).toBeNull();
    expect(contract.preloadApi.approveMethod).toBeNull();
    expect(contract.preloadApi.rejectMethod).toBeNull();
    expect(contract.storagePathPolicy.exposesAbsolutePathToRenderer).toBe(false);
  });

  it('redacts unsafe decision notes before persistence', () => {
    const [envelope] = sanitizeRuntimeActionApprovalDecisionEnvelopesForPersistence([decisionEnvelope()]);

    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain('token=secret');
    expect(serialized).not.toContain('/Users/brad/private');
    expect(serialized).toContain('[REDACTED]');
  });

  it('rejects invalid decision envelopes before persistence', () => {
    const invalid = validateRuntimeActionApprovalDecisionPersistenceWrite([
      decisionEnvelope({ state: 'invalid', auditEvents: [] }),
    ]);

    expect(invalid.valid).toBe(false);
    if (invalid.valid) throw new Error('expected invalid envelope to be rejected');
    expect(invalid.reason).toContain('valid terminal or native-confirmation');
  });

  it('builds read results without inventing approval decisions', () => {
    const empty = buildRuntimeActionApprovalDecisionReadResult({ available: true, decisions: [] });
    const unavailable = buildRuntimeActionApprovalDecisionReadResult({
      available: false,
      decisions: [decisionEnvelope()],
      error: 'raw /Users/brad/private token=secret',
    });

    expect(empty.status).toBe('empty');
    expect(empty.decisions).toEqual([]);
    expect(empty.message).toContain('No runtime action approval decisions');
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.decisions).toEqual([]);
    expect(unavailable.message).toContain('approval decision storage is unavailable');
    expect(unavailable.message).not.toContain('/Users/brad/private');
  });
});
