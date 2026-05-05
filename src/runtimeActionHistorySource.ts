import { redactRuntimeActionAuditEvent, type RuntimeActionAuditEvent } from './runtimeActionAuditLog';
import { buildRuntimeActionHistoryViewModel, type RuntimeActionHistoryViewModel } from './runtimeActionHistoryViewModel';

export type RuntimeActionHistorySourceKind = 'none' | 'electron-local';
export type RuntimeActionHistorySourceStatus = 'desktop_required' | 'not_connected' | 'ready' | 'error';

export type RuntimeActionHistorySourceState = {
  schemaVersion: 1;
  status: RuntimeActionHistorySourceStatus;
  sourceKind: RuntimeActionHistorySourceKind;
  canRead: boolean;
  message: string;
  events: RuntimeActionAuditEvent[];
  viewModel: RuntimeActionHistoryViewModel;
};

export type RuntimeActionHistorySourceInput = {
  desktopBridgeAvailable: boolean;
  sourceKind?: RuntimeActionHistorySourceKind;
  events?: RuntimeActionAuditEvent[];
  error?: string | null;
};

export function normalizeRuntimeActionHistorySourceEvents(events: RuntimeActionAuditEvent[]): RuntimeActionAuditEvent[] {
  return events.map((event) => redactRuntimeActionAuditEvent(event));
}

function emptySource(status: RuntimeActionHistorySourceStatus, sourceKind: RuntimeActionHistorySourceKind, message: string): RuntimeActionHistorySourceState {
  return {
    schemaVersion: 1,
    status,
    sourceKind,
    canRead: false,
    message,
    events: [],
    viewModel: buildRuntimeActionHistoryViewModel([]),
  };
}

export function buildRuntimeActionHistorySourceState(input: RuntimeActionHistorySourceInput): RuntimeActionHistorySourceState {
  if (!input.desktopBridgeAvailable) {
    return emptySource(
      'desktop_required',
      'none',
      'Runtime action history requires the Conductor desktop app. Browser mode cannot read local audit history.',
    );
  }

  const sourceKind = input.sourceKind ?? 'none';

  if (input.error) {
    return emptySource(
      'error',
      sourceKind,
      'Runtime action history source is unavailable. Details were redacted for display.',
    );
  }

  if (sourceKind === 'none') {
    return emptySource(
      'not_connected',
      'none',
      'No runtime action history source is connected yet. Conductor will not show fake activity.',
    );
  }

  const events = normalizeRuntimeActionHistorySourceEvents(input.events ?? []);
  return {
    schemaVersion: 1,
    status: 'ready',
    sourceKind,
    canRead: true,
    message: 'Runtime action history is loaded from a trusted desktop source.',
    events,
    viewModel: buildRuntimeActionHistoryViewModel(events),
  };
}
