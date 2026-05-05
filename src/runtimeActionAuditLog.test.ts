import { describe, expect, it } from 'vitest';
import {
  buildRuntimeActionAuditEvent,
  buildRuntimeActionAuditTimeline,
  redactRuntimeActionAuditEvent,
  type RuntimeActionAuditEvent,
} from './runtimeActionAuditLog';
import { buildRuntimeActionExecutionContract, type FutureExecutableRuntimeAction } from './runtimeActionAllowlist';
import { buildRuntimeActionRequestEnvelope, buildRuntimeActionResultEnvelope } from './runtimeActionRequestEnvelope';
import { safeAction } from './runtimeReadiness';

const executableRefresh = {
  ...safeAction('refresh'),
  executesCommand: true,
  previewOnly: false,
  allowlistedDesktopApi: 'runtime.refreshInventory',
} satisfies FutureExecutableRuntimeAction;

const request = buildRuntimeActionRequestEnvelope(
  executableRefresh,
  buildRuntimeActionExecutionContract(executableRefresh),
  {
    runtimeId: 'codex-cli',
    source: 'agent-runtimes',
    requestedBy: 'renderer',
    correlationId: 'audit-001',
  },
);

describe('runtime action audit log model', () => {
  it('records request-created events without raw command details', () => {
    const event = buildRuntimeActionAuditEvent({
      envelope: request,
      eventType: 'request_created',
      occurredAt: '2026-05-05T16:00:00.000Z',
    });

    expect(event).toMatchObject({
      schemaVersion: 1,
      eventType: 'request_created',
      occurredAt: '2026-05-05T16:00:00.000Z',
      correlationId: 'audit-001',
      runtimeId: 'codex-cli',
      actionKind: 'refresh',
      source: 'agent-runtimes',
      submitState: 'ready_for_desktop',
      desktopApi: 'runtime.refreshInventory',
      outcome: 'recorded',
      safeForLog: true,
      redactedFields: [],
    });
    expect(JSON.stringify(event)).not.toContain('command');
    expect(JSON.stringify(event)).not.toContain('shell');
    expect(JSON.stringify(event)).not.toContain('stderr');
  });

  it('records blocked events with sanitized reasons and no payload', () => {
    const blockedAction = {
      ...safeAction('configure'),
      executesCommand: true,
      previewOnly: false,
      allowlistedDesktopApi: 'shell.exec',
    } satisfies FutureExecutableRuntimeAction;
    const blockedEnvelope = buildRuntimeActionRequestEnvelope(
      blockedAction,
      buildRuntimeActionExecutionContract(blockedAction),
      {
        runtimeId: 'hermes',
        source: 'agent-runtimes',
        requestedBy: 'renderer',
        correlationId: 'audit-002',
      },
    );

    const event = buildRuntimeActionAuditEvent({
      envelope: blockedEnvelope,
      eventType: 'blocked',
      occurredAt: '2026-05-05T16:01:00.000Z',
    });

    expect(event).toMatchObject({
      eventType: 'blocked',
      outcome: 'blocked',
      payloadSummary: null,
      redactedFields: expect.arrayContaining(['payload']),
    });
    expect(event.reason).toContain('not in the runtime action allowlist');
  });

  it('records result events linked back to the original request', () => {
    const result = buildRuntimeActionResultEnvelope({
      correlationId: 'audit-001',
      status: 'completed',
      message: 'Inventory refresh completed.',
    });

    const event = buildRuntimeActionAuditEvent({
      envelope: request,
      result,
      eventType: 'completed',
      occurredAt: '2026-05-05T16:02:00.000Z',
    });

    expect(event).toMatchObject({
      eventType: 'completed',
      outcome: 'completed',
      resultStatus: 'completed',
      resultMessage: 'Inventory refresh completed.',
      correlationId: 'audit-001',
    });
  });

  it('builds chronological audit timelines from request and result stages', () => {
    const result = buildRuntimeActionResultEnvelope({
      correlationId: 'audit-001',
      status: 'cancelled',
      message: 'User cancelled before desktop submission.',
    });

    const timeline = buildRuntimeActionAuditTimeline({
      envelope: request,
      requestedAt: '2026-05-05T16:00:00.000Z',
      approvedAt: '2026-05-05T16:01:00.000Z',
      submittedAt: '2026-05-05T16:02:00.000Z',
      completedAt: '2026-05-05T16:03:00.000Z',
      result,
    });

    expect(timeline.map((event) => event.eventType)).toEqual([
      'request_created',
      'approved',
      'submitted_to_desktop',
      'cancelled',
    ]);
    expect(timeline.every((event) => event.correlationId === 'audit-001')).toBe(true);
  });

  it('redacts unsafe event fields before display or persistence', () => {
    const unsafeEvent = {
      schemaVersion: 1,
      eventType: 'failed',
      occurredAt: '2026-05-05T16:04:00.000Z',
      correlationId: 'audit-003',
      runtimeId: 'openclaw',
      actionKind: 'health_check',
      source: 'agent-runtimes',
      submitState: 'ready_for_desktop',
      desktopApi: 'runtime.runHealthCheck',
      outcome: 'failed',
      reason: 'Failed with private path /Users/brad/secret and token abc123',
      payloadSummary: 'command: bash -lc npm install',
      resultStatus: 'failed',
      resultMessage: 'stderr: token leaked',
      safeForLog: false,
      redactedFields: [],
    } satisfies RuntimeActionAuditEvent;

    const redacted = redactRuntimeActionAuditEvent(unsafeEvent);

    expect(redacted.safeForLog).toBe(true);
    expect(redacted.reason).toBe('[redacted]');
    expect(redacted.payloadSummary).toBe('[redacted]');
    expect(redacted.resultMessage).toBe('[redacted]');
    expect(redacted.redactedFields).toEqual(expect.arrayContaining(['reason', 'payloadSummary', 'resultMessage']));
  });
});
