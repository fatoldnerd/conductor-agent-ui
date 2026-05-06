import type { RuntimeActionApprovalQueueItem, RuntimeActionApprovalQueueState } from './runtimeActionApprovalWorkflow';

export type RuntimeActionApprovalQueueEntry = {
  correlationId: string;
  title: string;
  subtitle: string;
  requestedAt: string;
  runtimeId: RuntimeActionApprovalQueueItem['runtimeId'];
  actionKind: RuntimeActionApprovalQueueItem['actionKind'];
  riskLabel: string;
  canApprove: boolean;
  canReject: boolean;
  requiresNativeConfirmation: boolean;
  safetyNote: string;
  guardrails: string[];
};

export type RuntimeActionApprovalQueueStats = {
  total: number;
  awaitingApproval: number;
  blocked: number;
  notQueueable: number;
  decided: number;
};

export type RuntimeActionApprovalQueueViewModel = {
  schemaVersion: 1;
  empty: boolean;
  emptyTitle: string;
  emptyBody: string;
  stats: RuntimeActionApprovalQueueStats;
  entries: RuntimeActionApprovalQueueEntry[];
};

const EMPTY_TITLE = 'No runtime actions are awaiting approval';
const EMPTY_BODY = 'No fake approval requests are shown. Approval requests will appear only after Conductor has real allowlisted runtime action requests.';
const SAFETY_NOTE = 'Approval in Conductor does not execute anything by itself. A native desktop confirmation and allowlisted Electron API are still required before any future execution.';

function riskLabel(risk: RuntimeActionApprovalQueueItem['riskLevel']): string {
  if (risk === 'none') return 'no runtime risk';
  return `${risk} risk`;
}

function countState(items: RuntimeActionApprovalQueueItem[], state: RuntimeActionApprovalQueueState): number {
  return items.filter((item) => item.state === state).length;
}

function titleFromPrompt(prompt: string): string {
  return prompt.split(' Conductor will still require')[0];
}

export function buildRuntimeActionApprovalQueueViewModel(items: RuntimeActionApprovalQueueItem[]): RuntimeActionApprovalQueueViewModel {
  const entries = items
    .filter((item) => item.state === 'awaiting_approval')
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((item) => ({
      correlationId: item.correlationId,
      title: titleFromPrompt(item.approvalPrompt),
      subtitle: item.requestedSummary,
      requestedAt: item.requestedAt,
      runtimeId: item.runtimeId,
      actionKind: item.actionKind,
      riskLabel: riskLabel(item.riskLevel),
      canApprove: item.canApprove,
      canReject: item.canReject,
      requiresNativeConfirmation: item.requiresNativeConfirmation,
      safetyNote: SAFETY_NOTE,
      guardrails: item.guardrails,
    }));

  return {
    schemaVersion: 1,
    empty: entries.length === 0,
    emptyTitle: EMPTY_TITLE,
    emptyBody: EMPTY_BODY,
    stats: {
      total: items.length,
      awaitingApproval: entries.length,
      blocked: countState(items, 'blocked'),
      notQueueable: countState(items, 'not_queueable'),
      decided: countState(items, 'approved') + countState(items, 'rejected') + countState(items, 'cancelled'),
    },
    entries,
  };
}
