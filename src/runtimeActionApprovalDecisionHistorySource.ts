import type { RuntimeActionApprovalDecisionEnvelope } from './runtimeActionApprovalDecisionEnvelope';
import {
  sanitizeRuntimeActionApprovalDecisionEnvelopesForPersistence,
  type RuntimeActionApprovalDecisionReadResult,
} from './runtimeActionApprovalDecisionPersistence';

export type RuntimeActionApprovalDecisionHistorySourceKind = 'none' | 'electron-local';
export type RuntimeActionApprovalDecisionHistorySourceStatus = 'desktop_required' | 'not_connected' | 'ready' | 'error';

export type RuntimeActionApprovalDecisionHistoryEntry = {
  correlationId: string;
  title: string;
  subtitle: string;
  decidedAt: string;
  decision: RuntimeActionApprovalDecisionEnvelope['decision']['decision'];
  state: RuntimeActionApprovalDecisionEnvelope['state'];
  runtimeId: RuntimeActionApprovalDecisionEnvelope['runtimeId'];
  actionKind: RuntimeActionApprovalDecisionEnvelope['actionKind'];
  tone: 'ok' | 'warn' | 'muted';
  safetyNote: string;
};

export type RuntimeActionApprovalDecisionHistoryViewModel = {
  schemaVersion: 1;
  empty: boolean;
  emptyTitle: string;
  emptyBody: string;
  stats: {
    total: number;
    approved: number;
    rejected: number;
    cancelled: number;
    pendingNativeConfirmation: number;
  };
  entries: RuntimeActionApprovalDecisionHistoryEntry[];
};

export type RuntimeActionApprovalDecisionHistorySourceState = {
  schemaVersion: 1;
  status: RuntimeActionApprovalDecisionHistorySourceStatus;
  sourceKind: RuntimeActionApprovalDecisionHistorySourceKind;
  canRead: boolean;
  message: string;
  decisions: RuntimeActionApprovalDecisionEnvelope[];
  viewModel: RuntimeActionApprovalDecisionHistoryViewModel;
};

export type RuntimeActionApprovalDecisionHistorySourceInput = {
  desktopBridgeAvailable: boolean;
  sourceKind?: RuntimeActionApprovalDecisionHistorySourceKind;
  decisionEnvelopes?: RuntimeActionApprovalDecisionEnvelope[];
  decisions?: RuntimeActionApprovalDecisionReadResult;
  error?: string | null;
};

export function normalizeRuntimeActionApprovalDecisionHistorySourceDecisions(
  decisions: RuntimeActionApprovalDecisionEnvelope[],
): RuntimeActionApprovalDecisionEnvelope[] {
  return sanitizeRuntimeActionApprovalDecisionEnvelopesForPersistence(decisions);
}

function decisionTone(decision: RuntimeActionApprovalDecisionEnvelope): RuntimeActionApprovalDecisionHistoryEntry['tone'] {
  if (decision.decision.decision === 'approved') return 'ok';
  if (decision.decision.decision === 'rejected') return 'warn';
  return 'muted';
}

function decisionTitle(decision: RuntimeActionApprovalDecisionEnvelope): string {
  if (decision.decision.decision === 'approved') return 'Approved for native confirmation';
  if (decision.decision.decision === 'rejected') return 'Rejected by user';
  return 'Cancelled by user';
}

export function buildRuntimeActionApprovalDecisionHistoryViewModel(
  decisions: RuntimeActionApprovalDecisionEnvelope[],
): RuntimeActionApprovalDecisionHistoryViewModel {
  const normalized = normalizeRuntimeActionApprovalDecisionHistorySourceDecisions(decisions);
  const entries = normalized
    .map((decision) => ({
      correlationId: decision.correlationId,
      title: decisionTitle(decision),
      subtitle: `${decision.runtimeId} · ${decision.actionKind} · ${decision.source}`,
      decidedAt: decision.decision.decidedAt,
      decision: decision.decision.decision,
      state: decision.state,
      runtimeId: decision.runtimeId,
      actionKind: decision.actionKind,
      tone: decisionTone(decision),
      safetyNote: decision.execution.reason,
    }))
    .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));

  return {
    schemaVersion: 1,
    empty: entries.length === 0,
    emptyTitle: 'No approval decisions recorded',
    emptyBody: 'Conductor has not recorded any runtime action approval decisions yet. No fake decisions are shown.',
    stats: {
      total: normalized.length,
      approved: normalized.filter((decision) => decision.decision.decision === 'approved').length,
      rejected: normalized.filter((decision) => decision.decision.decision === 'rejected').length,
      cancelled: normalized.filter((decision) => decision.decision.decision === 'cancelled').length,
      pendingNativeConfirmation: normalized.filter((decision) => decision.state === 'accepted_for_native_confirmation').length,
    },
    entries,
  };
}

function emptySource(
  status: RuntimeActionApprovalDecisionHistorySourceStatus,
  sourceKind: RuntimeActionApprovalDecisionHistorySourceKind,
  message: string,
): RuntimeActionApprovalDecisionHistorySourceState {
  return {
    schemaVersion: 1,
    status,
    sourceKind,
    canRead: false,
    message,
    decisions: [],
    viewModel: buildRuntimeActionApprovalDecisionHistoryViewModel([]),
  };
}

export function buildRuntimeActionApprovalDecisionHistorySourceState(
  input: RuntimeActionApprovalDecisionHistorySourceInput,
): RuntimeActionApprovalDecisionHistorySourceState {
  if (!input.desktopBridgeAvailable) {
    return emptySource(
      'desktop_required',
      'none',
      'Runtime action approval decision history requires the Conductor desktop app. Browser mode cannot read local approval decisions.',
    );
  }

  const sourceKind = input.sourceKind ?? 'none';

  if (input.error) {
    return emptySource(
      'error',
      sourceKind,
      'Runtime action approval decision history source is unavailable. Details were redacted for display.',
    );
  }

  if (sourceKind === 'none') {
    return emptySource(
      'not_connected',
      'none',
      'No runtime action approval decision source is connected yet. Conductor will not show fake decisions.',
    );
  }

  if (input.decisions?.status === 'unavailable') {
    return emptySource(
      'error',
      sourceKind,
      'Runtime action approval decision history source is unavailable. Details were redacted for display.',
    );
  }

  const decisions = normalizeRuntimeActionApprovalDecisionHistorySourceDecisions(input.decisions?.decisions ?? input.decisionEnvelopes ?? []);
  return {
    schemaVersion: 1,
    status: 'ready',
    sourceKind,
    canRead: true,
    message: 'Runtime action approval decision history is loaded from a trusted desktop source.',
    decisions,
    viewModel: buildRuntimeActionApprovalDecisionHistoryViewModel(decisions),
  };
}
