import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('runtime action native confirmation renderer handoff', () => {
  it('asks Electron main for native confirmation only after approved decisions require it', () => {
    expect(appSource).toContain('confirmRuntimeActionNativeApprovalDecision');
    expect(appSource).toContain('window.conductor.runtimeActions.confirmNativeApprovalDecision');
    expect(appSource).toContain('result.nativeConfirmation.required');
    expect(appSource).toContain('await confirmRuntimeActionNativeApprovalDecision(result.correlationId)');
  });

  it('keeps native confirmation non-executing in renderer copy and guardrails', () => {
    expect(appSource).toContain('Native confirmation completed. No action executed.');
    expect(appSource).toContain('Native confirmation cancelled. No action executed.');
    expect(appSource).not.toContain('runtimeActions.execute');
    expect(appSource).not.toContain('runtimeActions.runDesktopApi');
  });
});
