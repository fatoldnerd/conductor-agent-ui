import { describe, expect, it } from 'vitest';
import {
  buildRuntimeActionRequestEnvelope,
  buildRuntimeActionResultEnvelope,
  type RuntimeActionRequestContext,
} from './runtimeActionRequestEnvelope';
import { buildRuntimeActionExecutionContract, type FutureExecutableRuntimeAction } from './runtimeActionAllowlist';
import { safeAction } from './runtimeReadiness';

const context: RuntimeActionRequestContext = {
  runtimeId: 'codex-cli',
  source: 'agent-runtimes',
  requestedBy: 'renderer',
  correlationId: 'runtime-action-001',
};

describe('runtime action request envelope', () => {
  it('creates metadata-only envelopes that cannot be submitted for execution', () => {
    const action = safeAction('health_check');
    const envelope = buildRuntimeActionRequestEnvelope(action, buildRuntimeActionExecutionContract(action), context);

    expect(envelope).toMatchObject({
      schemaVersion: 1,
      runtimeId: 'codex-cli',
      actionKind: 'health_check',
      source: 'agent-runtimes',
      requestedBy: 'renderer',
      correlationId: 'runtime-action-001',
      submitState: 'not_submittable',
      payload: null,
    });
    expect(envelope.desktopApi).toBeNull();
    expect(envelope.reason).toContain('metadata-only');
    expect(envelope.audit.safeForLog).toBe(true);
    expect(envelope.audit.redactedFields).toEqual([]);
  });

  it('creates blocked envelopes for executable actions without an allowlisted desktop API', () => {
    const action = {
      ...safeAction('configure'),
      executesCommand: true,
      previewOnly: false,
      allowlistedDesktopApi: 'shell.exec',
    } satisfies FutureExecutableRuntimeAction;
    const envelope = buildRuntimeActionRequestEnvelope(action, buildRuntimeActionExecutionContract(action), context);

    expect(envelope).toMatchObject({
      submitState: 'blocked',
      desktopApi: null,
      payload: null,
    });
    expect(envelope.reason).toContain('not in the runtime action allowlist');
    expect(envelope.audit.redactedFields).toEqual(expect.arrayContaining(['payload']));
  });

  it('creates pending approval envelopes for future allowlisted desktop actions', () => {
    const action = {
      ...safeAction('health_check'),
      executesCommand: true,
      previewOnly: false,
      allowlistedDesktopApi: 'runtime.runHealthCheck',
      preflight: {
        ...safeAction('health_check').preflight,
        requiresApproval: true,
      },
    } satisfies FutureExecutableRuntimeAction;
    const envelope = buildRuntimeActionRequestEnvelope(action, buildRuntimeActionExecutionContract(action), {
      ...context,
      runtimeId: 'claude-code',
      correlationId: 'runtime-action-002',
    });

    expect(envelope).toMatchObject({
      runtimeId: 'claude-code',
      actionKind: 'health_check',
      submitState: 'pending_approval',
      desktopApi: 'runtime.runHealthCheck',
      payload: {
        runtimeId: 'claude-code',
        actionKind: 'health_check',
      },
    });
    expect(envelope.payload).not.toHaveProperty('command');
    expect(envelope.payload).not.toHaveProperty('shell');
    expect(envelope.audit.redactedFields).toEqual([]);
  });

  it('creates ready envelopes for future non-mutating allowlisted desktop actions that do not need approval', () => {
    const action = {
      ...safeAction('refresh'),
      executesCommand: true,
      previewOnly: false,
      allowlistedDesktopApi: 'runtime.refreshInventory',
    } satisfies FutureExecutableRuntimeAction;
    const envelope = buildRuntimeActionRequestEnvelope(action, buildRuntimeActionExecutionContract(action), context);

    expect(envelope).toMatchObject({
      actionKind: 'refresh',
      submitState: 'ready_for_desktop',
      desktopApi: 'runtime.refreshInventory',
      payload: {
        runtimeId: 'codex-cli',
        actionKind: 'refresh',
      },
    });
  });

  it('normalizes result envelopes without exposing raw stderr or command details', () => {
    const result = buildRuntimeActionResultEnvelope({
      correlationId: 'runtime-action-003',
      status: 'blocked',
      message: 'Blocked because approval is required.',
      detail: 'Raw stderr and shell command intentionally unavailable.',
    });

    expect(result).toMatchObject({
      schemaVersion: 1,
      correlationId: 'runtime-action-003',
      status: 'blocked',
      message: 'Blocked because approval is required.',
    });
    expect(result.detail).toContain('intentionally unavailable');
    expect(result).not.toHaveProperty('stderr');
    expect(result).not.toHaveProperty('command');
  });
});
