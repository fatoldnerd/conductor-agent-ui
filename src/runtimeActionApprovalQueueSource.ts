import type { RuntimeActionApprovalQueueItem } from './runtimeActionApprovalWorkflow';
import { buildRuntimeActionApprovalQueueViewModel, type RuntimeActionApprovalQueueViewModel } from './runtimeActionApprovalQueueViewModel';

export type RuntimeActionApprovalQueueSourceKind = 'none' | 'electron-local';
export type RuntimeActionApprovalQueueSourceStatus = 'desktop_required' | 'not_connected' | 'ready' | 'error';

export type RuntimeActionApprovalQueueSourceState = {
  schemaVersion: 1;
  status: RuntimeActionApprovalQueueSourceStatus;
  sourceKind: RuntimeActionApprovalQueueSourceKind;
  canRead: boolean;
  message: string;
  items: RuntimeActionApprovalQueueItem[];
  viewModel: RuntimeActionApprovalQueueViewModel;
};

export type RuntimeActionApprovalQueueSourceInput = {
  desktopBridgeAvailable: boolean;
  sourceKind?: RuntimeActionApprovalQueueSourceKind;
  items?: RuntimeActionApprovalQueueItem[];
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

function normalizeQueueItem(item: RuntimeActionApprovalQueueItem): RuntimeActionApprovalQueueItem {
  return {
    ...item,
    requestedSummary: redactText(item.requestedSummary),
    approvalPrompt: redactText(item.approvalPrompt),
    guardrails: item.guardrails.map((guardrail) => redactText(guardrail)),
  };
}

export function normalizeRuntimeActionApprovalQueueSourceItems(items: RuntimeActionApprovalQueueItem[]): RuntimeActionApprovalQueueItem[] {
  return items.map((item) => normalizeQueueItem(item));
}

function emptySource(
  status: RuntimeActionApprovalQueueSourceStatus,
  sourceKind: RuntimeActionApprovalQueueSourceKind,
  message: string,
): RuntimeActionApprovalQueueSourceState {
  return {
    schemaVersion: 1,
    status,
    sourceKind,
    canRead: false,
    message,
    items: [],
    viewModel: buildRuntimeActionApprovalQueueViewModel([]),
  };
}

export function buildRuntimeActionApprovalQueueSourceState(
  input: RuntimeActionApprovalQueueSourceInput,
): RuntimeActionApprovalQueueSourceState {
  if (!input.desktopBridgeAvailable) {
    return emptySource(
      'desktop_required',
      'none',
      'Runtime action approval queue requires the Conductor desktop app. Browser mode cannot read local approval requests.',
    );
  }

  const sourceKind = input.sourceKind ?? 'none';

  if (input.error) {
    return emptySource(
      'error',
      sourceKind,
      'Runtime action approval queue source is unavailable. Details were redacted for display.',
    );
  }

  if (sourceKind === 'none') {
    return emptySource(
      'not_connected',
      'none',
      'No runtime action approval queue source is connected yet. Conductor will not show fake approvals.',
    );
  }

  const items = normalizeRuntimeActionApprovalQueueSourceItems(input.items ?? []);
  return {
    schemaVersion: 1,
    status: 'ready',
    sourceKind,
    canRead: true,
    message: 'Runtime action approval queue is loaded from a trusted desktop source.',
    items,
    viewModel: buildRuntimeActionApprovalQueueViewModel(items),
  };
}
