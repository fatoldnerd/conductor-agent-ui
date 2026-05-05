import { describe, expect, it } from 'vitest';
import type { RuntimeActionAuditEvent } from './runtimeActionAuditLog';
import {
  buildRuntimeActionAuditPersistenceContract,
  buildRuntimeActionAuditPersistenceReadResult,
  sanitizeRuntimeActionAuditEventsForPersistence,
  validateRuntimeActionAuditPersistenceWrite,
} from './runtimeActionAuditPersistence';

function auditEvent(overrides: Partial<RuntimeActionAuditEvent> = {}): RuntimeActionAuditEvent {
  return {
    schemaVersion: 1,
    eventType: 'request_created',
    occurredAt: '2026-05-05T20:00:00.000Z',
    correlationId: 'persist-001',
    runtimeId: 'claude-code',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    submitState: 'pending_approval',
    desktopApi: 'runtime.runHealthCheck',
    outcome: 'recorded',
    reason: 'Safe diagnostic request',
    payloadSummary: 'claude-code:health_check',
    safeForLog: true,
    redactedFields: [],
    ...overrides,
  };
}

describe('runtime action audit persistence contract', () => {
  it('defines Electron-main-owned append and read contracts without renderer writes', () => {
    const contract = buildRuntimeActionAuditPersistenceContract();

    expect(contract.schemaVersion).toBe(1);
    expect(contract.owner).toBe('electron_main');
    expect(contract.storageKind).toBe('local_jsonl');
    expect(contract.appendMode).toBe('append_only');
    expect(contract.rendererAccess.canRead).toBe(true);
    expect(contract.rendererAccess.canAppend).toBe(false);
    expect(contract.rendererAccess.canMutate).toBe(false);
    expect(contract.preloadApi?.readMethod).toBe('runtimeActions.getAuditHistory');
    expect(contract.preloadApi?.appendMethod).toBeNull();
  });

  it('stores only sanitized audit events and never persists unsafe display text', () => {
    const unsafe = auditEvent({
      reason: 'command bash -lc npm run secret',
      resultMessage: 'stderr token leaked',
      safeForLog: false,
    });

    const events = sanitizeRuntimeActionAuditEventsForPersistence([unsafe]);

    expect(events).toHaveLength(1);
    expect(events[0].safeForLog).toBe(true);
    expect(events[0].reason).toBe('[redacted]');
    expect(events[0].resultMessage).toBe('[redacted]');
    expect(events[0].redactedFields).toEqual(expect.arrayContaining(['reason', 'resultMessage']));
  });

  it('rejects persistence writes that contain unsanitized events', () => {
    const unsafe = auditEvent({
      safeForLog: false,
      reason: 'token should not be persisted',
    });

    const validation = validateRuntimeActionAuditPersistenceWrite([unsafe]);

    expect(validation.valid).toBe(false);
    if (validation.valid) throw new Error('expected unsafe persistence write to be rejected');
    expect(validation.reason).toContain('safeForLog');
  });

  it('accepts sanitized append batches with stable retention metadata', () => {
    const event = auditEvent();
    const validation = validateRuntimeActionAuditPersistenceWrite([event]);

    expect(validation.valid).toBe(true);
    expect(validation.eventCount).toBe(1);
    expect(validation.retention.maxEvents).toBeGreaterThan(0);
    expect(validation.retention.maxAgeDays).toBeGreaterThan(0);
  });

  it('builds read results that preserve source status and do not invent history', () => {
    const empty = buildRuntimeActionAuditPersistenceReadResult({ available: true, events: [] });
    const unavailable = buildRuntimeActionAuditPersistenceReadResult({ available: false, events: [auditEvent()], error: 'private path failed' });

    expect(empty.status).toBe('empty');
    expect(empty.events).toEqual([]);
    expect(empty.message).toContain('No runtime action audit events have been recorded');
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.events).toEqual([]);
    expect(unavailable.message).toContain('Audit history storage is unavailable');
  });
});
