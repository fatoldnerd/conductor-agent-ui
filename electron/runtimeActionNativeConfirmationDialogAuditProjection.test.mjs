import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import decisionStore from './runtimeActionApprovalDecisionStore.cjs';
import auditStore from './runtimeActionAuditStore.cjs';
import dialog from './runtimeActionNativeConfirmationDialog.cjs';

const { appendRuntimeActionApprovalDecisionEnvelopes, setRuntimeActionApprovalDecisionPath } = decisionStore;
const { readRuntimeActionAuditHistory, setRuntimeActionAuditLogPath } = auditStore;
const { confirmRuntimeActionNativeConfirmation, setRuntimeActionNativeConfirmationDialogPaths } = dialog;

function decision(correlationId = 'corr_native_audit_dialog') {
  return {
    schemaVersion: 1,
    state: 'accepted_for_native_confirmation',
    correlationId,
    runtimeId: 'claude-code',
    actionKind: 'desktop_api',
    source: 'renderer',
    queue: {
      status: 'awaiting_approval',
      requestedAt: '2026-05-06T18:00:00.000Z',
      requestedSummary: 'Open project folder',
      approvalPrompt: 'Approve opening a folder?',
      guardrails: ['No arbitrary shell access'],
    },
    decision: {
      decision: 'approved',
      decidedAt: '2026-05-06T18:01:00.000Z',
      note: 'Approved note token=abc123',
    },
    nativeConfirmation: {
      required: true,
      implemented: true,
      reason: 'Native confirmation required before execution.',
    },
    execution: {
      rendererCanExecute: false,
      requiresNativeConfirmation: true,
      desktopApi: 'open_project_folder',
      reason: 'Execution is not implemented.',
    },
    auditEvents: [],
    audit: {
      safeForLog: true,
      redactedFields: [],
    },
  };
}

describe('native confirmation dialog audit projection', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'conductor-native-confirmation-audit-'));
    setRuntimeActionApprovalDecisionPath(path.join(dir, 'decisions.jsonl'));
    setRuntimeActionAuditLogPath(path.join(dir, 'audit.jsonl'));
    setRuntimeActionNativeConfirmationDialogPaths({
      decisionPath: path.join(dir, 'decisions.jsonl'),
      confirmationPath: path.join(dir, 'confirmations.jsonl'),
      auditPath: path.join(dir, 'audit.jsonl'),
    });
  });

  it('appends an audit event when native confirmation is confirmed without execution', async () => {
    appendRuntimeActionApprovalDecisionEnvelopes([decision()]);

    const result = await confirmRuntimeActionNativeConfirmation(
      { correlationId: 'corr_native_audit_dialog' },
      { showMessageBox: async () => ({ response: 1 }) },
    );
    const audit = readRuntimeActionAuditHistory();

    expect(result.status).toBe('confirmed_no_execution');
    expect(audit.status).toBe('ready');
    expect(audit.events[0]).toMatchObject({
      eventType: 'native_confirmation_confirmed',
      correlationId: 'corr_native_audit_dialog',
      outcome: 'confirmed_no_execution',
      resultStatus: 'cancelled',
      safeForLog: true,
    });
    expect(audit.events[0].desktopApi).toBeNull();
    expect(audit.events[0].resultMessage).toContain('No action executed');
  });

  it('appends an audit event when native confirmation is cancelled without execution', async () => {
    appendRuntimeActionApprovalDecisionEnvelopes([decision('corr_native_audit_cancel')]);

    await confirmRuntimeActionNativeConfirmation(
      { correlationId: 'corr_native_audit_cancel' },
      { showMessageBox: async () => ({ response: 0 }) },
    );
    const audit = readRuntimeActionAuditHistory();

    expect(audit.events[0]).toMatchObject({
      eventType: 'native_confirmation_cancelled',
      correlationId: 'corr_native_audit_cancel',
      outcome: 'cancelled_no_execution',
      resultStatus: 'cancelled',
    });
    expect(audit.events[0].resultMessage).toContain('No action executed');
  });
});
