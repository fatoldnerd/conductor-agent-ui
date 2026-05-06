import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('runtime action approval controls renderer contract', () => {
  it('wires approval queue Approve and Reject controls to the constrained decision submit bridge', () => {
    expect(appSource).toContain('submitRuntimeActionApprovalDecisionFromQueue');
    expect(appSource).toContain('window.conductor.runtimeActions.submitApprovalDecision');
    expect(appSource).toContain("entry.correlationId, 'approved'");
    expect(appSource).toContain("entry.correlationId, 'rejected'");
    expect(appSource).toContain('Approving...');
    expect(appSource).toContain('Rejecting...');
    expect(appSource).toContain('Approve');
    expect(appSource).toContain('Reject');
  });

  it('refreshes pending queue and decision history after a decision submit succeeds', () => {
    expect(appSource).toContain('await loadRuntimeActionApprovalQueue()');
    expect(appSource).toContain('await loadRuntimeActionApprovalDecisionHistory()');
    expect(appSource).toContain('approvalDecisionSubmittingId');
    expect(appSource).toContain('approvalDecisionSubmitError');
  });

  it('keeps renderer approval controls non-executing and desktop-bridge gated', () => {
    expect(appSource).toContain('No command executes from these controls');
    expect(appSource).toContain('disabled={!window.conductor?.runtimeActions.submitApprovalDecision');
    expect(appSource).not.toContain('runtimeActions.execute');
    expect(appSource).not.toContain('runtimeActions.runDesktopApi');
    expect(appSource).not.toContain('runtimeActions.confirmNative');
  });
});
