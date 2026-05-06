import { describe, expect, it } from 'vitest';
import projection from './runtimeActionNativeConfirmationAuditProjection.cjs';

const { buildRuntimeActionNativeConfirmationAuditEvent } = projection;

function baseConfirmation(overrides = {}) {
  return {
    schemaVersion: 1,
    status: 'confirmed_no_execution',
    correlationId: 'corr_audit_projection_1',
    confirmedAt: '2026-05-06T18:00:00.000Z',
    runtimeId: 'claude-code',
    actionKind: 'desktop_api',
    source: 'renderer',
    nativeConfirmation: {
      required: true,
      shown: true,
      confirmed: true,
      implemented: true,
      reason: 'Native confirmation accepted for token=abc123 /Users/brad/private',
    },
    execution: {
      rendererCanExecute: false,
      executed: false,
      reason: 'Execution not implemented. command bash -lc should redact.',
    },
    message: 'Native confirmation completed for /root/private. No action executed.',
    ...overrides,
  };
}

describe('runtime action native confirmation audit projection', () => {
  it('projects confirmed native confirmation outcomes into safe non-executing audit events', () => {
    const event = buildRuntimeActionNativeConfirmationAuditEvent(baseConfirmation());

    expect(event).toMatchObject({
      schemaVersion: 1,
      eventType: 'native_confirmation_confirmed',
      occurredAt: '2026-05-06T18:00:00.000Z',
      correlationId: 'corr_audit_projection_1',
      runtimeId: 'claude-code',
      actionKind: 'desktop_api',
      source: 'renderer',
      submitState: 'pending_approval',
      desktopApi: null,
      outcome: 'confirmed_no_execution',
      safeForLog: true,
    });
    expect(event.resultStatus).toBe('cancelled');
    expect(event.resultMessage).toContain('No action executed');
    expect(event.payloadSummary).toBe('[redacted]');
    expect(event.reason).toBe('[redacted]');
    expect(event.redactedFields).toEqual(expect.arrayContaining(['payloadSummary', 'reason']));
  });

  it('projects cancelled and invalid outcomes without creating executable audit states', () => {
    const cancelled = buildRuntimeActionNativeConfirmationAuditEvent(baseConfirmation({
      status: 'cancelled_no_execution',
      nativeConfirmation: { required: true, shown: true, confirmed: false, implemented: true, reason: 'cancelled' },
    }));
    const invalid = buildRuntimeActionNativeConfirmationAuditEvent(baseConfirmation({
      status: 'invalid',
      nativeConfirmation: { required: true, shown: false, confirmed: false, implemented: true, reason: 'invalid' },
    }));

    expect(cancelled.eventType).toBe('native_confirmation_cancelled');
    expect(cancelled.outcome).toBe('cancelled_no_execution');
    expect(cancelled.resultStatus).toBe('cancelled');
    expect(invalid.eventType).toBe('native_confirmation_invalid');
    expect(invalid.outcome).toBe('invalid');
    expect(invalid.resultStatus).toBe('blocked');
    expect([cancelled, invalid].every((event) => event.desktopApi === null && event.safeForLog)).toBe(true);
  });

  it('rejects native confirmation audit projection for executable-looking results', () => {
    expect(() => buildRuntimeActionNativeConfirmationAuditEvent(baseConfirmation({
      execution: { rendererCanExecute: true, executed: false, reason: 'bad' },
    }))).toThrow(/non-executing/);
    expect(() => buildRuntimeActionNativeConfirmationAuditEvent(baseConfirmation({
      execution: { rendererCanExecute: false, executed: true, reason: 'bad' },
    }))).toThrow(/non-executing/);
  });
});
