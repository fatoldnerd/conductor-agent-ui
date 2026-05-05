import { describe, expect, it } from 'vitest';
import { buildRuntimeActionApproval } from './runtimeActionApproval';
import { safeAction } from './runtimeReadiness';

describe('runtime action approval architecture', () => {
  it('treats preview actions as future approval only, not live execution', () => {
    const approval = buildRuntimeActionApproval(safeAction('health_check'));

    expect(approval).toMatchObject({
      mode: 'future_approval_required',
      executionCapability: 'metadata_only',
      canExecuteNow: false,
      approvalRequiredBeforeExecution: true,
    });
    expect(approval.userFacingSummary).toContain('Runtime readiness is not blocked');
    expect(approval.userFacingSummary).toContain('future Conductor-triggered action');
    expect(approval.guardrails).toEqual(expect.arrayContaining([
      'Renderer must not execute arbitrary shell commands.',
      'No command runs from this preview/preflight action.',
    ]));
  });

  it('treats non-mutating safe actions as metadata-only with no approval requirement', () => {
    const approval = buildRuntimeActionApproval(safeAction('open_docs'));

    expect(approval).toMatchObject({
      mode: 'no_approval_required',
      executionCapability: 'metadata_only',
      canExecuteNow: false,
      approvalRequiredBeforeExecution: false,
    });
    expect(approval.userFacingSummary).toContain('No approval is required for this non-mutating action');
  });

  it('keeps desktop-required actions blocked unless an allowlisted desktop API exists', () => {
    const approval = buildRuntimeActionApproval(safeAction('requires_desktop'));

    expect(approval).toMatchObject({
      mode: 'blocked_until_desktop_allowlisted',
      executionCapability: 'requires_allowlisted_desktop_api',
      canExecuteNow: false,
    });
    expect(approval.guardrails).toEqual(expect.arrayContaining([
      'Execution requires an explicit allowlisted Electron main-process API.',
      'Browser mode must not imply executable runtime actions.',
    ]));
  });
});
