import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('production operational UI data sources', () => {
  it('does not import mock operational data into App.tsx', () => {
    expect(appSource).not.toContain('./data/mockData');
  });

  it('does not render known runtime rows in browser Agent Runtimes mode', () => {
    expect(appSource).not.toContain('AgentRuntimeBrowserPreview');
  });

  it('renders runtime cards from canonical card metadata fields', () => {
    expect(appSource).toContain('tool.categoryLabel');
    expect(appSource).toContain('tool.diagnosis');
    expect(appSource).toContain('tool.primaryAction');
    expect(appSource).toContain('RuntimeDetailPanel');
    expect(appSource).toContain('tool.detailPanel');
    expect(appSource).toContain('action.previewOnly');
    expect(appSource).toContain('Suggested preview');
    expect(appSource).toContain('ActionPreflightDetails');
    expect(appSource).toContain('action.preflight.expectedEffect');
    expect(appSource).toContain('action.approval.userFacingSummary');
    expect(appSource).toContain('action.approval.mode');
    expect(appSource).toContain('action.executionContract.status');
    expect(appSource).toContain('action.executionContract.reason');
    expect(appSource).toContain('action.requestEnvelope?.submitState');
    expect(appSource).toContain('action.approvalWorkflow?.state');
    expect(appSource).toContain('action.approvalWorkflow?.approvalPrompt');
    expect(appSource).toContain('buildRuntimeActionHistorySourceState');
    expect(appSource).toContain('window.conductor.runtimeActions.getAuditHistory');
    expect(appSource).toContain('runtimeActionHistorySource.status');
    expect(appSource).toContain('runtimeActionHistory.empty');
    expect(appSource).toContain('historyLoading');
    expect(appSource).toContain('historyError');
    expect(appSource).toContain('buildRuntimeActionApprovalQueueSourceState');
    expect(appSource).toContain('window.conductor.runtimeActions.getApprovalQueue');
    expect(appSource).toContain('runtimeActionApprovalQueueSource.status');
    expect(appSource).toContain('runtimeActionApprovalQueue.empty');
    expect(appSource).toContain('queueLoading');
    expect(appSource).toContain('queueError');
    expect(appSource).toContain('buildRuntimeActionApprovalDecisionHistorySourceState');
    expect(appSource).toContain('window.conductor.runtimeActions.getApprovalDecisions');
    expect(appSource).toContain('runtimeActionApprovalDecisionHistorySource.status');
    expect(appSource).toContain('runtimeActionApprovalDecisionHistory.empty');
    expect(appSource).toContain('decisionHistoryLoading');
    expect(appSource).toContain('decisionHistoryError');
    expect(appSource).toContain('window.conductor.runtimeActions.submitApprovalDecision');
    expect(appSource).toContain('submitRuntimeActionApprovalDecisionFromQueue');
    expect(appSource).toContain('buildRuntimeActionNativeConfirmationHistorySourceState');
    expect(appSource).toContain('window.conductor.runtimeActions.getNativeConfirmations');
    expect(appSource).toContain('window.conductor.runtimeActions.refreshInventory');
    expect(appSource).toContain('refreshInventoryResult.inventory');
    expect(appSource).toContain('runtimeActionNativeConfirmationHistorySource.status');
    expect(appSource).toContain('No action executed from native confirmation');
    expect(appSource).toContain('No command executes from these controls');
    expect(appSource).toContain('No command will run without explicit approval');
    expect(appSource).toContain('readinessLabel(tool.readiness)');
  });
});
