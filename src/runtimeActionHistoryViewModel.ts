import type { RuntimeActionAuditEvent, RuntimeActionAuditEventType } from './runtimeActionAuditLog';
import { CANONICAL_RUNTIME_LABELS, type RuntimeActionKind } from './runtimeReadiness';

export type RuntimeActionHistoryState =
  | 'requested'
  | 'pending_approval'
  | 'approved'
  | 'blocked'
  | 'submitted'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RuntimeActionHistoryTone = 'ok' | 'warn' | 'muted' | 'danger';

export type RuntimeActionHistoryTimelineRow = {
  eventType: RuntimeActionAuditEventType;
  label: string;
  occurredAt: string;
  outcome: RuntimeActionAuditEvent['outcome'];
  detail: string | null;
  redactedFields: string[];
};

export type RuntimeActionHistoryEntry = {
  correlationId: string;
  runtimeId: RuntimeActionAuditEvent['runtimeId'];
  runtimeLabel: string;
  actionKind: RuntimeActionKind;
  actionLabel: string;
  sourceLabel: string;
  state: RuntimeActionHistoryState;
  tone: RuntimeActionHistoryTone;
  title: string;
  subtitle: string;
  eventCount: number;
  firstAt: string;
  latestAt: string;
  timeline: RuntimeActionHistoryTimelineRow[];
};

export type RuntimeActionHistoryStats = {
  total: number;
  pendingApproval: number;
  blocked: number;
  completed: number;
  failedOrCancelled: number;
};

export type RuntimeActionHistoryViewModel = {
  schemaVersion: 1;
  empty: boolean;
  emptyTitle: string;
  emptyBody: string;
  stats: RuntimeActionHistoryStats;
  entries: RuntimeActionHistoryEntry[];
};

const EMPTY_TITLE = 'No runtime action history yet';
const EMPTY_BODY =
  'No sample or synthetic activity is shown. Runtime action history will appear only after Conductor has real sanitized audit events.';

function actionLabel(actionKind: RuntimeActionKind): string {
  return actionKind.replace(/_/g, ' ');
}

function sourceLabel(source: RuntimeActionAuditEvent['source']): string {
  if (source === 'agent-runtimes') return 'Agent Runtimes';
  if (source === 'dashboard') return 'Dashboard';
  if (source === 'diagnostics') return 'Diagnostics';
  return 'Installer';
}

function eventLabel(eventType: RuntimeActionAuditEventType): string {
  if (eventType === 'request_created') return 'Request created';
  if (eventType === 'approval_required') return 'Approval required';
  if (eventType === 'approved') return 'Approved';
  if (eventType === 'blocked') return 'Blocked';
  if (eventType === 'submitted_to_desktop') return 'Submitted to desktop';
  if (eventType === 'completed') return 'Completed';
  if (eventType === 'failed') return 'Failed';
  return 'Cancelled';
}

function detailFor(event: RuntimeActionAuditEvent): string | null {
  return event.resultMessage ?? event.reason ?? event.payloadSummary ?? null;
}

function stateFor(events: RuntimeActionAuditEvent[]): RuntimeActionHistoryState {
  const types = events.map((event) => event.eventType);
  if (types.includes('failed')) return 'failed';
  if (types.includes('cancelled')) return 'cancelled';
  if (types.includes('completed')) return 'completed';
  if (types.includes('submitted_to_desktop')) return 'submitted';
  if (types.includes('blocked')) return 'blocked';
  if (types.includes('approved')) return 'approved';
  if (types.includes('approval_required')) return 'pending_approval';
  return 'requested';
}

function toneFor(state: RuntimeActionHistoryState): RuntimeActionHistoryTone {
  if (state === 'blocked' || state === 'failed') return 'danger';
  if (state === 'pending_approval') return 'warn';
  if (state === 'completed' || state === 'approved') return 'ok';
  return 'muted';
}

function subtitleFor(state: RuntimeActionHistoryState): string {
  if (state === 'pending_approval') return 'Waiting for explicit user approval before any trusted desktop handoff.';
  if (state === 'approved') return 'Approved and waiting for trusted desktop execution.';
  if (state === 'blocked') return 'Blocked by Conductor safety rules before approval or execution.';
  if (state === 'submitted') return 'Submitted to an allowlisted desktop API after approval checks.';
  if (state === 'completed') return 'Completed according to the sanitized runtime action result.';
  if (state === 'failed') return 'Failed according to the sanitized runtime action result.';
  if (state === 'cancelled') return 'Cancelled before completion.';
  return 'Request recorded in the sanitized runtime action history.';
}

function toTimelineRow(event: RuntimeActionAuditEvent): RuntimeActionHistoryTimelineRow {
  return {
    eventType: event.eventType,
    label: eventLabel(event.eventType),
    occurredAt: event.occurredAt,
    outcome: event.outcome,
    detail: detailFor(event),
    redactedFields: event.redactedFields,
  };
}

function groupByCorrelationId(events: RuntimeActionAuditEvent[]): RuntimeActionAuditEvent[][] {
  const groups = new Map<string, RuntimeActionAuditEvent[]>();
  for (const event of events) {
    groups.set(event.correlationId, [...(groups.get(event.correlationId) ?? []), event]);
  }
  return [...groups.values()].map((group) => group.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)));
}

function toEntry(events: RuntimeActionAuditEvent[]): RuntimeActionHistoryEntry {
  const first = events[0];
  const latest = events[events.length - 1];
  const state = stateFor(events);
  const runtimeLabel = CANONICAL_RUNTIME_LABELS[first.runtimeId];
  const action = actionLabel(first.actionKind);

  return {
    correlationId: first.correlationId,
    runtimeId: first.runtimeId,
    runtimeLabel,
    actionKind: first.actionKind,
    actionLabel: action,
    sourceLabel: sourceLabel(first.source),
    state,
    tone: toneFor(state),
    title: `${runtimeLabel} ${action}`,
    subtitle: subtitleFor(state),
    eventCount: events.length,
    firstAt: first.occurredAt,
    latestAt: latest.occurredAt,
    timeline: events.map(toTimelineRow),
  };
}

export function summarizeRuntimeActionHistory(entries: RuntimeActionHistoryEntry[]): RuntimeActionHistoryStats {
  return {
    total: entries.length,
    pendingApproval: entries.filter((entry) => entry.state === 'pending_approval').length,
    blocked: entries.filter((entry) => entry.state === 'blocked').length,
    completed: entries.filter((entry) => entry.state === 'completed').length,
    failedOrCancelled: entries.filter((entry) => entry.state === 'failed' || entry.state === 'cancelled').length,
  };
}

export function buildRuntimeActionHistoryViewModel(events: RuntimeActionAuditEvent[]): RuntimeActionHistoryViewModel {
  const entries = groupByCorrelationId(events)
    .map(toEntry)
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt));

  return {
    schemaVersion: 1,
    empty: entries.length === 0,
    emptyTitle: EMPTY_TITLE,
    emptyBody: EMPTY_BODY,
    stats: summarizeRuntimeActionHistory(entries),
    entries,
  };
}
