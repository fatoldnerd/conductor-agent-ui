export type RuntimeActionNativeConfirmationStatus = 'confirmed_no_execution' | 'cancelled_no_execution' | 'invalid';
export type RuntimeActionNativeConfirmationHistorySourceKind = 'none' | 'electron-local';
export type RuntimeActionNativeConfirmationHistorySourceStatus = 'desktop_required' | 'not_connected' | 'ready' | 'error';

export type RuntimeActionNativeConfirmationHistoryRecord = {
  schemaVersion: 1;
  status: RuntimeActionNativeConfirmationStatus;
  correlationId: string;
  confirmedAt: string;
  runtimeId: string;
  actionKind: string;
  source: string;
  nativeConfirmation: {
    required: boolean;
    shown: boolean;
    confirmed: boolean;
    implemented: true;
    reason: string;
  };
  execution: {
    rendererCanExecute: false;
    executed: false;
    reason: string;
  };
  message: string;
};

export type RuntimeActionNativeConfirmationReadResult = {
  schemaVersion: 1;
  status: 'unavailable' | 'empty' | 'ready';
  confirmations: unknown[];
  message: string;
};

export type RuntimeActionNativeConfirmationHistoryEntry = {
  correlationId: string;
  title: string;
  subtitle: string;
  confirmedAt: string;
  status: RuntimeActionNativeConfirmationStatus;
  tone: 'ok' | 'muted' | 'warn';
  executionNote: string;
};

export type RuntimeActionNativeConfirmationHistoryViewModel = {
  schemaVersion: 1;
  empty: boolean;
  emptyTitle: string;
  emptyBody: string;
  stats: {
    total: number;
    confirmed: number;
    cancelled: number;
    invalid: number;
  };
  entries: RuntimeActionNativeConfirmationHistoryEntry[];
};

export type RuntimeActionNativeConfirmationHistorySourceState = {
  schemaVersion: 1;
  status: RuntimeActionNativeConfirmationHistorySourceStatus;
  sourceKind: RuntimeActionNativeConfirmationHistorySourceKind;
  canRead: boolean;
  message: string;
  confirmations: RuntimeActionNativeConfirmationHistoryRecord[];
  viewModel: RuntimeActionNativeConfirmationHistoryViewModel;
};

export type RuntimeActionNativeConfirmationHistorySourceInput = {
  desktopBridgeAvailable: boolean;
  sourceKind?: RuntimeActionNativeConfirmationHistorySourceKind;
  confirmations?: RuntimeActionNativeConfirmationReadResult;
  confirmationRecords?: RuntimeActionNativeConfirmationHistoryRecord[];
  error?: string | null;
};

const SENSITIVE_TEXT_PATTERNS = [
  /\b(token|secret|api[_-]?key|password)\s*=\s*[^\s,;]+/gi,
  /\/Users\/[^\s,;]+/g,
  /\/home\/[^\s,;]+/g,
  /\/root\/[^\s,;]+/g,
];

function redactText(value: string): string {
  return SENSITIVE_TEXT_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), value);
}

function isNativeConfirmationRecord(input: unknown): input is RuntimeActionNativeConfirmationHistoryRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const record = input as Partial<RuntimeActionNativeConfirmationHistoryRecord>;
  return record.schemaVersion === 1
    && ['confirmed_no_execution', 'cancelled_no_execution', 'invalid'].includes(String(record.status))
    && typeof record.correlationId === 'string'
    && typeof record.confirmedAt === 'string'
    && typeof record.runtimeId === 'string'
    && typeof record.actionKind === 'string'
    && typeof record.source === 'string'
    && Boolean(record.nativeConfirmation)
    && Boolean(record.execution)
    && record.execution?.rendererCanExecute === false
    && record.execution?.executed === false;
}

export function normalizeRuntimeActionNativeConfirmationHistoryRecords(
  confirmations: unknown[],
): RuntimeActionNativeConfirmationHistoryRecord[] {
  return confirmations.filter(isNativeConfirmationRecord).map((record) => ({
    ...record,
    runtimeId: redactText(record.runtimeId),
    actionKind: redactText(record.actionKind),
    source: redactText(record.source),
    nativeConfirmation: {
      ...record.nativeConfirmation,
      reason: redactText(record.nativeConfirmation.reason),
    },
    execution: {
      ...record.execution,
      rendererCanExecute: false,
      executed: false,
      reason: redactText(record.execution.reason),
    },
    message: redactText(record.message),
  }));
}

function confirmationTitle(record: RuntimeActionNativeConfirmationHistoryRecord): string {
  if (record.status === 'confirmed_no_execution') return 'Native confirmation completed';
  if (record.status === 'cancelled_no_execution') return 'Native confirmation cancelled';
  return 'Native confirmation blocked';
}

function confirmationTone(record: RuntimeActionNativeConfirmationHistoryRecord): RuntimeActionNativeConfirmationHistoryEntry['tone'] {
  if (record.status === 'confirmed_no_execution') return 'ok';
  if (record.status === 'cancelled_no_execution') return 'muted';
  return 'warn';
}

export function buildRuntimeActionNativeConfirmationHistoryViewModel(
  confirmations: unknown[],
): RuntimeActionNativeConfirmationHistoryViewModel {
  const normalized = normalizeRuntimeActionNativeConfirmationHistoryRecords(confirmations);
  const entries = normalized
    .map((record) => ({
      correlationId: record.correlationId,
      title: confirmationTitle(record),
      subtitle: `${record.runtimeId} · ${record.actionKind} · ${record.source}`,
      confirmedAt: record.confirmedAt,
      status: record.status,
      tone: confirmationTone(record),
      executionNote: 'No action executed.',
    }))
    .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));

  return {
    schemaVersion: 1,
    empty: entries.length === 0,
    emptyTitle: 'No native confirmations recorded',
    emptyBody: 'Conductor has not recorded any runtime action native confirmations yet. No fake confirmations are shown.',
    stats: {
      total: normalized.length,
      confirmed: normalized.filter((record) => record.status === 'confirmed_no_execution').length,
      cancelled: normalized.filter((record) => record.status === 'cancelled_no_execution').length,
      invalid: normalized.filter((record) => record.status === 'invalid').length,
    },
    entries,
  };
}

function emptySource(
  status: RuntimeActionNativeConfirmationHistorySourceStatus,
  sourceKind: RuntimeActionNativeConfirmationHistorySourceKind,
  message: string,
): RuntimeActionNativeConfirmationHistorySourceState {
  return {
    schemaVersion: 1,
    status,
    sourceKind,
    canRead: false,
    message,
    confirmations: [],
    viewModel: buildRuntimeActionNativeConfirmationHistoryViewModel([]),
  };
}

export function buildRuntimeActionNativeConfirmationHistorySourceState(
  input: RuntimeActionNativeConfirmationHistorySourceInput,
): RuntimeActionNativeConfirmationHistorySourceState {
  if (!input.desktopBridgeAvailable) {
    return emptySource(
      'desktop_required',
      'none',
      'Runtime action native confirmation history requires the Conductor desktop app. Browser mode cannot read local confirmations.',
    );
  }

  const sourceKind = input.sourceKind ?? 'none';
  if (input.error || input.confirmations?.status === 'unavailable') {
    return emptySource('error', sourceKind, 'Runtime action native confirmation history source is unavailable. Details were redacted for display.');
  }
  if (sourceKind === 'none') {
    return emptySource('not_connected', 'none', 'No runtime action native confirmation source is connected yet. Conductor will not show fake confirmations.');
  }

  const confirmations = normalizeRuntimeActionNativeConfirmationHistoryRecords(input.confirmations?.confirmations ?? input.confirmationRecords ?? []);
  return {
    schemaVersion: 1,
    status: 'ready',
    sourceKind,
    canRead: true,
    message: 'Runtime action native confirmation history is loaded from a trusted desktop source.',
    confirmations,
    viewModel: buildRuntimeActionNativeConfirmationHistoryViewModel(confirmations),
  };
}
