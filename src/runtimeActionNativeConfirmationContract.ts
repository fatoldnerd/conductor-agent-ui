import type { AllowlistedRuntimeActionApi } from './runtimeActionAllowlist';
import {
  validateRuntimeActionDecisionEnvelopeForSubmit,
  type RuntimeActionApprovalDecisionEnvelope,
} from './runtimeActionApprovalDecisionEnvelope';

export type RuntimeActionNativeConfirmationOwner = 'electron_main';
export type RuntimeActionNativeConfirmationRequestState = 'invalid' | 'awaiting_native_confirmation';

export type RuntimeActionNativeConfirmationContract = {
  schemaVersion: 1;
  owner: RuntimeActionNativeConfirmationOwner;
  rendererAccess: {
    canReadPreview: true;
    canConfirm: false;
    canExecute: false;
    reason: string;
  };
  preloadApi: {
    previewMethod: 'runtimeActions.getNativeConfirmationPreview';
    confirmMethod: null;
    executeMethod: null;
  };
  nativeDialog: {
    required: true;
    implemented: false;
    reason: string;
  };
};

export type RuntimeActionNativeConfirmationDialogPreview = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  riskSummary: string;
};

export type RuntimeActionNativeConfirmationRequest = {
  schemaVersion: 1;
  state: RuntimeActionNativeConfirmationRequestState;
  owner: RuntimeActionNativeConfirmationOwner;
  correlationId: string;
  runtimeId: RuntimeActionApprovalDecisionEnvelope['runtimeId'];
  actionKind: RuntimeActionApprovalDecisionEnvelope['actionKind'];
  source: RuntimeActionApprovalDecisionEnvelope['source'];
  desktopApi: AllowlistedRuntimeActionApi | null;
  rendererCanConfirm: false;
  rendererCanExecute: false;
  executionAfterConfirmation: 'not_implemented';
  dialogPreview: RuntimeActionNativeConfirmationDialogPreview;
  reason: string;
};

export type RuntimeActionNativeConfirmationValidation =
  | { valid: true; reason: string }
  | { valid: false; reason: string };

const SENSITIVE_TEXT_PATTERNS = [
  /\b(token|secret|api[_-]?key|password)\s*=\s*[^\s,;]+/gi,
  /\/Users\/[^\s,;]+/g,
  /\/home\/[^\s,;]+/g,
  /\/root\/[^\s,;]+/g,
];

function redactText(value: string): string {
  return SENSITIVE_TEXT_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), value);
}

function runtimeLabel(runtimeId: string): string {
  return runtimeId
    .split('-')
    .map((part) => (part.toLowerCase() === 'cli' ? 'CLI' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

export function buildRuntimeActionNativeConfirmationContract(): RuntimeActionNativeConfirmationContract {
  return {
    schemaVersion: 1,
    owner: 'electron_main',
    rendererAccess: {
      canReadPreview: true,
      canConfirm: false,
      canExecute: false,
      reason: 'The renderer may display sanitized native-confirmation previews, but only Electron main may later own native dialogs and execution.',
    },
    preloadApi: {
      previewMethod: 'runtimeActions.getNativeConfirmationPreview',
      confirmMethod: null,
      executeMethod: null,
    },
    nativeDialog: {
      required: true,
      implemented: false,
      reason: 'This contract is model-only. It intentionally adds no native dialog, IPC confirmation method, or execution handler.',
    },
  };
}

function invalidRequest(input: { decisionEnvelope: RuntimeActionApprovalDecisionEnvelope; reason: string }): RuntimeActionNativeConfirmationRequest {
  return {
    schemaVersion: 1,
    state: 'invalid',
    owner: 'electron_main',
    correlationId: input.decisionEnvelope.correlationId,
    runtimeId: input.decisionEnvelope.runtimeId,
    actionKind: input.decisionEnvelope.actionKind,
    source: input.decisionEnvelope.source,
    desktopApi: null,
    rendererCanConfirm: false,
    rendererCanExecute: false,
    executionAfterConfirmation: 'not_implemented',
    dialogPreview: {
      title: 'Native confirmation unavailable',
      body: 'This runtime action approval decision cannot continue to native confirmation.',
      confirmLabel: 'Unavailable',
      cancelLabel: 'Cancel',
      riskSummary: 'No command can run from this invalid request.',
    },
    reason: redactText(input.reason),
  };
}

export function buildRuntimeActionNativeConfirmationRequest(input: {
  decisionEnvelope: RuntimeActionApprovalDecisionEnvelope;
}): RuntimeActionNativeConfirmationRequest {
  const validation = validateRuntimeActionDecisionEnvelopeForSubmit(input.decisionEnvelope);
  if (!validation.valid || !input.decisionEnvelope.execution.desktopApi) {
    return invalidRequest({ decisionEnvelope: input.decisionEnvelope, reason: validation.reason });
  }

  const label = runtimeLabel(input.decisionEnvelope.runtimeId);
  const note = input.decisionEnvelope.decision.note ? ` User note: ${input.decisionEnvelope.decision.note}` : '';
  return {
    schemaVersion: 1,
    state: 'awaiting_native_confirmation',
    owner: 'electron_main',
    correlationId: input.decisionEnvelope.correlationId,
    runtimeId: input.decisionEnvelope.runtimeId,
    actionKind: input.decisionEnvelope.actionKind,
    source: input.decisionEnvelope.source,
    desktopApi: input.decisionEnvelope.execution.desktopApi,
    rendererCanConfirm: false,
    rendererCanExecute: false,
    executionAfterConfirmation: 'not_implemented',
    dialogPreview: {
      title: 'Confirm runtime action',
      body: redactText(`${label} requested ${input.decisionEnvelope.actionKind}. A future Electron-main native dialog must confirm this before any execution handler can be considered.${note}`),
      confirmLabel: 'Confirm in desktop app',
      cancelLabel: 'Cancel',
      riskSummary: 'Approval is not execution. This model adds no native dialog, no approve/reject IPC, and no command runner.',
    },
    reason: 'Approved decision is eligible for a future Electron-main native confirmation dialog, but execution is not implemented.',
  };
}

export function validateRuntimeActionNativeConfirmationRequest(
  request: RuntimeActionNativeConfirmationRequest,
): RuntimeActionNativeConfirmationValidation {
  if (request.state !== 'awaiting_native_confirmation') {
    return { valid: false, reason: 'Only awaiting native-confirmation requests can be considered by a future native dialog.' };
  }
  if (!request.desktopApi || request.rendererCanConfirm || request.rendererCanExecute || request.executionAfterConfirmation !== 'not_implemented') {
    return { valid: false, reason: 'Native confirmation request must stay Electron-main-owned and non-executable in this contract.' };
  }
  return {
    valid: true,
    reason: 'Native confirmation request is model-only. Electron main must implement a dialog and a separate allowlisted execution handler later.',
  };
}
