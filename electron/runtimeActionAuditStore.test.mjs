import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import auditStore from './runtimeActionAuditStore.cjs';

const {
  appendRuntimeActionAuditEvents,
  readRuntimeActionAuditHistory,
  setRuntimeActionAuditLogPath,
} = auditStore;

const tempDirs = [];

function tempLogPath() {
  const dir = mkdtempSync(join(tmpdir(), 'conductor-runtime-audit-'));
  tempDirs.push(dir);
  return join(dir, 'runtime-action-audit.jsonl');
}

function auditEvent(overrides = {}) {
  return {
    schemaVersion: 1,
    eventType: 'request_created',
    occurredAt: '2026-05-05T20:00:00.000Z',
    correlationId: 'store-001',
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

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('runtime action audit main-process store', () => {
  it('returns an empty read result when the audit log does not exist', () => {
    setRuntimeActionAuditLogPath(tempLogPath());

    const result = readRuntimeActionAuditHistory();

    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'empty',
      events: [],
      message: expect.stringContaining('No runtime action audit events'),
    });
  });

  it('appends sanitized events as JSONL and reads them back newest-first safe for renderer display', () => {
    const logPath = tempLogPath();
    setRuntimeActionAuditLogPath(logPath);

    appendRuntimeActionAuditEvents([
      auditEvent({ correlationId: 'older', occurredAt: '2026-05-05T19:00:00.000Z' }),
      auditEvent({
        correlationId: 'newer',
        occurredAt: '2026-05-05T21:00:00.000Z',
        reason: 'command bash -lc token should not persist',
        payloadSummary: '/Users/private/tool',
        safeForLog: false,
      }),
    ]);

    const raw = readFileSync(logPath, 'utf8');
    const result = readRuntimeActionAuditHistory();

    expect(raw).not.toContain('bash -lc');
    expect(raw).not.toContain('/Users/private');
    expect(result.status).toBe('ready');
    expect(result.events.map((event) => event.correlationId)).toEqual(['newer', 'older']);
    expect(result.events[0]).toMatchObject({
      reason: '[redacted]',
      payloadSummary: '[redacted]',
      safeForLog: true,
      redactedFields: expect.arrayContaining(['reason', 'payloadSummary']),
    });
  });

  it('rejects malformed audit events and does not create renderer-visible storage paths', () => {
    const logPath = tempLogPath();
    setRuntimeActionAuditLogPath(logPath);

    expect(() => appendRuntimeActionAuditEvents([{ eventType: 'request_created' }])).toThrow(/invalid runtime action audit event/i);

    const result = readRuntimeActionAuditHistory();
    expect(JSON.stringify(result)).not.toContain(logPath);
  });

  it('recovers from corrupt JSONL rows without exposing raw parse errors', () => {
    const logPath = tempLogPath();
    setRuntimeActionAuditLogPath(logPath);
    appendRuntimeActionAuditEvents([auditEvent()]);
    const raw = readFileSync(logPath, 'utf8');
    auditStore.__unsafeWriteRawForTest(`${raw}{not json containing /Users/private token}\n`);

    const result = readRuntimeActionAuditHistory();

    expect(result.status).toBe('ready');
    expect(result.events).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('/Users/private');
    expect(JSON.stringify(result)).not.toContain('not json');
  });
});
