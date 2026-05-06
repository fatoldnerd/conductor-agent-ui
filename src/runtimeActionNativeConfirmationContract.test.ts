import { describe, expect, it } from 'vitest';
import { buildRuntimeActionExecutionContract, type FutureExecutableRuntimeAction } from './runtimeActionAllowlist';
import { buildRuntimeActionApprovalDecision, buildRuntimeActionApprovalQueueItem } from './runtimeActionApprovalWorkflow';
import { buildRuntimeActionDecisionEnvelope } from './runtimeActionApprovalDecisionEnvelope';
import { buildRuntimeActionRequestEnvelope } from './runtimeActionRequestEnvelope';
import { safeAction } from './runtimeReadiness';
import {
  buildRuntimeActionNativeConfirmationRequest,
  buildRuntimeActionNativeConfirmationContract,
  validateRuntimeActionNativeConfirmationRequest,
} from './runtimeActionNativeConfirmationContract';

function futureHealthCheckAction(): FutureExecutableRuntimeAction {
  return {
    ...safeAction('health_check'),
    executesCommand: true,
    allowlistedDesktopApi: 'runtime.runHealthCheck',
  };
}

function pendingQueueItem(correlationId = 'native-confirmation-1') {
  const action = futureHealthCheckAction();
  const contract = buildRuntimeActionExecutionContract(action);
  const envelope = buildRuntimeActionRequestEnvelope(action, contract, {
    runtimeId: 'codex-cli',
    source: 'agent-runtimes',
    requestedBy: 'renderer',
    correlationId,
  });
  return buildRuntimeActionApprovalQueueItem({ envelope, requestedAt: '2026-05-06T14:05:00.000Z' });
}

describe('runtime action native confirmation contract', () => {
  it('documents Electron-main ownership without exposing renderer confirmation or execution', () => {
    const contract = buildRuntimeActionNativeConfirmationContract();

    expect(contract).toMatchObject({
      schemaVersion: 1,
      owner: 'electron_main',
      rendererAccess: {
        canReadPreview: true,
        canConfirm: false,
        canExecute: false,
      },
      preloadApi: {
        confirmMethod: null,
        executeMethod: null,
      },
      nativeDialog: {
        required: true,
        implemented: false,
      },
    });
  });

  it('turns only approved decision envelopes into native-confirmation requests', () => {
    const approved = buildRuntimeActionDecisionEnvelope({
      item: pendingQueueItem(),
      decision: buildRuntimeActionApprovalDecision({ decision: 'approved', decidedAt: '2026-05-06T14:06:00.000Z', decidedBy: 'user' }),
    });

    const request = buildRuntimeActionNativeConfirmationRequest({ decisionEnvelope: approved });

    expect(request).toMatchObject({
      schemaVersion: 1,
      state: 'awaiting_native_confirmation',
      correlationId: 'native-confirmation-1',
      owner: 'electron_main',
      desktopApi: 'runtime.runHealthCheck',
      rendererCanConfirm: false,
      rendererCanExecute: false,
      executionAfterConfirmation: 'not_implemented',
      dialogPreview: expect.objectContaining({
        title: 'Confirm runtime action',
        confirmLabel: 'Confirm in desktop app',
        cancelLabel: 'Cancel',
      }),
    });
    expect(request.dialogPreview.body).toContain('Codex CLI');
  });

  it('rejects rejected, cancelled, invalid, or executable-looking decision envelopes', () => {
    const rejected = buildRuntimeActionDecisionEnvelope({
      item: pendingQueueItem('rejected-native-confirmation'),
      decision: buildRuntimeActionApprovalDecision({ decision: 'rejected', decidedAt: '2026-05-06T14:06:00.000Z', decidedBy: 'user' }),
    });

    const request = buildRuntimeActionNativeConfirmationRequest({ decisionEnvelope: rejected });

    expect(request).toMatchObject({
      state: 'invalid',
      desktopApi: null,
      rendererCanConfirm: false,
      rendererCanExecute: false,
      executionAfterConfirmation: 'not_implemented',
    });
    expect(validateRuntimeActionNativeConfirmationRequest(request)).toMatchObject({ valid: false });
  });

  it('redacts dialog preview strings before any renderer-readable display', () => {
    const approved = buildRuntimeActionDecisionEnvelope({
      item: pendingQueueItem('redacted-native-confirmation'),
      decision: buildRuntimeActionApprovalDecision({
        decision: 'approved',
        decidedAt: '2026-05-06T14:06:00.000Z',
        decidedBy: 'user',
        note: 'Reviewed /Users/brad/private with token=secret',
      }),
    });

    const request = buildRuntimeActionNativeConfirmationRequest({ decisionEnvelope: approved });
    const serialized = JSON.stringify(request);

    expect(serialized).not.toContain('/Users/brad/private');
    expect(serialized).not.toContain('token=secret');
    expect(serialized).toContain('[REDACTED]');
  });

  it('validates the request as a model-only handoff and not an executable command', () => {
    const approved = buildRuntimeActionDecisionEnvelope({
      item: pendingQueueItem('valid-native-confirmation'),
      decision: buildRuntimeActionApprovalDecision({ decision: 'approved', decidedAt: '2026-05-06T14:06:00.000Z', decidedBy: 'user' }),
    });
    const request = buildRuntimeActionNativeConfirmationRequest({ decisionEnvelope: approved });

    expect(validateRuntimeActionNativeConfirmationRequest(request)).toEqual({
      valid: true,
      reason: 'Native confirmation request is model-only. Electron main must implement a dialog and a separate allowlisted execution handler later.',
    });
  });
});
