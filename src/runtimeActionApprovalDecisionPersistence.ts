import type { RuntimeActionApprovalDecisionEnvelope } from './runtimeActionApprovalDecisionEnvelope';

export type RuntimeActionApprovalDecisionPersistenceOwner = 'electron_main';
export type RuntimeActionApprovalDecisionPersistenceStorageKind = 'local_jsonl';
export type RuntimeActionApprovalDecisionPersistenceAppendMode = 'append_only';
export type RuntimeActionApprovalDecisionReadStatus = 'unavailable' | 'empty' | 'ready';

export type RuntimeActionApprovalDecisionRetentionPolicy = {
  maxDecisions: number;
  maxAgeDays: number;
  redactionRequired: true;
};

export type RuntimeActionApprovalDecisionPersistenceContract = {
  schemaVersion: 1;
  owner: RuntimeActionApprovalDecisionPersistenceOwner;
  storageKind: RuntimeActionApprovalDecisionPersistenceStorageKind;
  appendMode: RuntimeActionApprovalDecisionPersistenceAppendMode;
  retention: RuntimeActionApprovalDecisionRetentionPolicy;
  rendererAccess: {
    canRead: true;
    canAppend: false;
    canMutate: false;
    canExecute: false;
    reason: string;
  };
  preloadApi: {
    readMethod: 'runtimeActions.getApprovalDecisions';
    appendMethod: null;
    approveMethod: null;
    rejectMethod: null;
  };
  storagePathPolicy: {
    kind: 'app_user_data';
    exposesAbsolutePathToRenderer: false;
    fileName: 'runtime-action-approval-decisions.jsonl';
  };
};

export type RuntimeActionApprovalDecisionReadResult = {
  schemaVersion: 1;
  status: RuntimeActionApprovalDecisionReadStatus;
  decisions: RuntimeActionApprovalDecisionEnvelope[];
  message: string;
};

export type RuntimeActionApprovalDecisionPersistenceWriteValidation =
  | { valid: true; decisionCount: number; retention: RuntimeActionApprovalDecisionRetentionPolicy }
  | { valid: false; reason: string; decisionCount: number; retention: RuntimeActionApprovalDecisionRetentionPolicy };

const DEFAULT_RETENTION: RuntimeActionApprovalDecisionRetentionPolicy = {
  maxDecisions: 2_000,
  maxAgeDays: 90,
  redactionRequired: true,
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

export function buildRuntimeActionApprovalDecisionPersistenceContract(): RuntimeActionApprovalDecisionPersistenceContract {
  return {
    schemaVersion: 1,
    owner: 'electron_main',
    storageKind: 'local_jsonl',
    appendMode: 'append_only',
    retention: DEFAULT_RETENTION,
    rendererAccess: {
      canRead: true,
      canAppend: false,
      canMutate: false,
      canExecute: false,
      reason: 'The renderer may read sanitized approval decision history, but Electron main owns writes, native confirmation, and any future execution.',
    },
    preloadApi: {
      readMethod: 'runtimeActions.getApprovalDecisions',
      appendMethod: null,
      approveMethod: null,
      rejectMethod: null,
    },
    storagePathPolicy: {
      kind: 'app_user_data',
      exposesAbsolutePathToRenderer: false,
      fileName: 'runtime-action-approval-decisions.jsonl',
    },
  };
}

export function sanitizeRuntimeActionApprovalDecisionEnvelopesForPersistence(
  decisions: RuntimeActionApprovalDecisionEnvelope[],
): RuntimeActionApprovalDecisionEnvelope[] {
  return decisions.map((envelope) => ({
    ...envelope,
    decision: {
      ...envelope.decision,
      ...(envelope.decision.note ? { note: redactText(envelope.decision.note) } : {}),
      safeForLog: true,
    },
    execution: {
      ...envelope.execution,
      rendererCanExecute: false,
      reason: redactText(envelope.execution.reason),
    },
  }));
}

export function validateRuntimeActionApprovalDecisionPersistenceWrite(
  decisions: RuntimeActionApprovalDecisionEnvelope[],
): RuntimeActionApprovalDecisionPersistenceWriteValidation {
  const retention = buildRuntimeActionApprovalDecisionPersistenceContract().retention;
  const invalid = decisions.find((decision) => {
    if (decision.schemaVersion !== 1) return true;
    if (decision.state === 'invalid') return true;
    if (decision.execution.rendererCanExecute) return true;
    if (decision.state === 'accepted_for_native_confirmation') {
      return decision.decision.decision !== 'approved' || !decision.execution.requiresNativeConfirmation || !decision.execution.desktopApi;
    }
    if (decision.state === 'rejected' || decision.state === 'cancelled') {
      return decision.execution.requiresNativeConfirmation || decision.execution.desktopApi !== null;
    }
    return true;
  });

  if (invalid) {
    return {
      valid: false,
      reason: `Approval decision persistence only accepts valid terminal or native-confirmation decision envelopes. Invalid envelope: ${invalid.correlationId}.`,
      decisionCount: decisions.length,
      retention,
    };
  }

  return { valid: true, decisionCount: decisions.length, retention };
}

export function buildRuntimeActionApprovalDecisionReadResult(input: {
  available: boolean;
  decisions: RuntimeActionApprovalDecisionEnvelope[];
  error?: string | null;
}): RuntimeActionApprovalDecisionReadResult {
  if (!input.available || input.error) {
    return {
      schemaVersion: 1,
      status: 'unavailable',
      decisions: [],
      message: 'Runtime action approval decision storage is unavailable. Details were redacted for display.',
    };
  }

  const decisions = sanitizeRuntimeActionApprovalDecisionEnvelopesForPersistence(input.decisions);
  if (decisions.length === 0) {
    return {
      schemaVersion: 1,
      status: 'empty',
      decisions: [],
      message: 'No runtime action approval decisions have been recorded yet. Conductor will not show fake decisions.',
    };
  }

  return {
    schemaVersion: 1,
    status: 'ready',
    decisions,
    message: 'Runtime action approval decisions were read from local desktop storage.',
  };
}
