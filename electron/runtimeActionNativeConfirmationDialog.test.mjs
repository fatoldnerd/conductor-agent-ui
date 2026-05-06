import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import decisionStore from './runtimeActionApprovalDecisionStore.cjs';
import nativeDialog from './runtimeActionNativeConfirmationDialog.cjs';

const { appendRuntimeActionApprovalDecisionEnvelopes, setRuntimeActionApprovalDecisionPath } = decisionStore;
const { confirmRuntimeActionNativeConfirmation, setRuntimeActionNativeConfirmationDialogPaths } = nativeDialog;

function decisionEnvelope(overrides = {}) {
  return {
    schemaVersion: 1,
    state: 'accepted_for_native_confirmation',
    correlationId: 'native-dialog-001',
    runtimeId: 'codex-cli',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    decision: {
      schemaVersion: 1,
      decision: 'approved',
      decidedAt: '2026-05-06T16:00:00.000Z',
      decidedBy: 'user',
      note: 'Approved after checking /Users/brad/private token=secret',
      safeForLog: true,
    },
    execution: {
      rendererCanExecute: false,
      requiresNativeConfirmation: true,
      desktopApi: 'runtime.runHealthCheck',
      reason: 'Approved decisions require native desktop confirmation before any execution can begin.',
    },
    auditEvents: [],
    ...overrides,
  };
}

beforeEach(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'conductor-native-confirmation-dialog-'));
  const decisionPath = path.join(dir, 'decisions.jsonl');
  setRuntimeActionApprovalDecisionPath(decisionPath);
  setRuntimeActionNativeConfirmationDialogPaths({ decisionPath });
});

describe('runtime action native confirmation dialog', () => {
  it('shows a generic Electron-main native confirmation for approved decisions without executing anything', async () => {
    appendRuntimeActionApprovalDecisionEnvelopes([decisionEnvelope()]);
    const dialogCalls = [];

    const result = await confirmRuntimeActionNativeConfirmation(
      { correlationId: 'native-dialog-001' },
      {
        showMessageBox: async (_parentWindow, options) => {
          dialogCalls.push(options);
          return { response: 1 };
        },
        parentWindow: { id: 123 },
      },
    );

    expect(dialogCalls).toHaveLength(1);
    expect(dialogCalls[0]).toMatchObject({
      type: 'warning',
      title: 'Confirm runtime action',
      message: 'Confirm approved runtime action?',
      buttons: ['Cancel', 'Confirm'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    expect(dialogCalls[0].detail).toContain('Runtime: Codex CLI');
    expect(dialogCalls[0].detail).toContain('Action: health_check');
    expect(dialogCalls[0].detail).toContain('API: runtime.runHealthCheck');
    expect(dialogCalls[0].detail).toContain('Execution is not implemented');
    expect(JSON.stringify(dialogCalls[0])).not.toContain('Brad');
    expect(JSON.stringify(dialogCalls[0])).not.toContain('/Users/brad/private');
    expect(JSON.stringify(dialogCalls[0])).not.toContain('token=secret');

    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'confirmed_no_execution',
      correlationId: 'native-dialog-001',
      nativeConfirmation: { required: true, shown: true, confirmed: true },
      execution: { rendererCanExecute: false, executed: false, reason: expect.stringContaining('not implemented') },
    });
  });

  it('returns a cancelled non-executing result when the native dialog is cancelled', async () => {
    appendRuntimeActionApprovalDecisionEnvelopes([decisionEnvelope({ correlationId: 'cancel-native-dialog' })]);

    const result = await confirmRuntimeActionNativeConfirmation(
      { correlationId: 'cancel-native-dialog' },
      { showMessageBox: async () => ({ response: 0 }), parentWindow: null },
    );

    expect(result).toMatchObject({
      status: 'cancelled_no_execution',
      correlationId: 'cancel-native-dialog',
      nativeConfirmation: { shown: true, confirmed: false },
      execution: { rendererCanExecute: false, executed: false },
    });
  });

  it('fails closed for unknown or non-approved decisions without showing the dialog', async () => {
    appendRuntimeActionApprovalDecisionEnvelopes([
      decisionEnvelope({
        correlationId: 'rejected-native-dialog',
        state: 'rejected',
        decision: { schemaVersion: 1, decision: 'rejected', decidedAt: '2026-05-06T16:01:00.000Z', decidedBy: 'user', safeForLog: true },
        execution: { rendererCanExecute: false, requiresNativeConfirmation: false, desktopApi: null, reason: 'Rejected is terminal.' },
      }),
    ]);
    let dialogShown = false;
    const deps = { showMessageBox: async () => { dialogShown = true; return { response: 1 }; }, parentWindow: null };

    expect(await confirmRuntimeActionNativeConfirmation({ correlationId: 'missing-native-dialog' }, deps)).toMatchObject({
      status: 'invalid',
      execution: { rendererCanExecute: false, executed: false },
    });
    expect(await confirmRuntimeActionNativeConfirmation({ correlationId: 'rejected-native-dialog' }, deps)).toMatchObject({
      status: 'invalid',
      execution: { rendererCanExecute: false, executed: false },
    });
    expect(dialogShown).toBe(false);
  });
});
