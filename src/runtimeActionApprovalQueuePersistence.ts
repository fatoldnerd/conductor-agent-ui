import type { RuntimeActionApprovalQueueItem } from './runtimeActionApprovalWorkflow';
import { normalizeRuntimeActionApprovalQueueSourceItems, type RuntimeActionApprovalQueueReadResult } from './runtimeActionApprovalQueueSource';

export type RuntimeActionApprovalQueuePersistenceOwner = 'electron_main';
export type RuntimeActionApprovalQueuePersistenceStorageKind = 'local_jsonl';
export type RuntimeActionApprovalQueuePersistenceAppendMode = 'append_only';

export type RuntimeActionApprovalQueueRetentionPolicy = {
  maxItems: number;
  maxAgeDays: number;
  redactionRequired: true;
};

export type RuntimeActionApprovalQueuePersistenceContract = {
  schemaVersion: 1;
  owner: RuntimeActionApprovalQueuePersistenceOwner;
  storageKind: RuntimeActionApprovalQueuePersistenceStorageKind;
  appendMode: RuntimeActionApprovalQueuePersistenceAppendMode;
  retention: RuntimeActionApprovalQueueRetentionPolicy;
  rendererAccess: {
    canRead: true;
    canAppend: false;
    canMutate: false;
    canApprove: false;
    canReject: false;
    reason: string;
  };
  preloadApi: {
    readMethod: 'runtimeActions.getApprovalQueue';
    appendMethod: null;
    approveMethod: null;
    rejectMethod: null;
  };
  storagePathPolicy: {
    kind: 'app_user_data';
    exposesAbsolutePathToRenderer: false;
    fileName: 'runtime-action-approval-queue.jsonl';
  };
};

export type RuntimeActionApprovalQueuePersistenceWriteValidation =
  | {
      valid: true;
      itemCount: number;
      retention: RuntimeActionApprovalQueueRetentionPolicy;
    }
  | {
      valid: false;
      reason: string;
      itemCount: number;
      retention: RuntimeActionApprovalQueueRetentionPolicy;
    };

const DEFAULT_RETENTION: RuntimeActionApprovalQueueRetentionPolicy = {
  maxItems: 1_000,
  maxAgeDays: 30,
  redactionRequired: true,
};

export function buildRuntimeActionApprovalQueuePersistenceContract(): RuntimeActionApprovalQueuePersistenceContract {
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
      canApprove: false,
      canReject: false,
      reason: 'The renderer may request sanitized approval queue items, but Electron main owns queue writes and all future approval decisions.',
    },
    preloadApi: {
      readMethod: 'runtimeActions.getApprovalQueue',
      appendMethod: null,
      approveMethod: null,
      rejectMethod: null,
    },
    storagePathPolicy: {
      kind: 'app_user_data',
      exposesAbsolutePathToRenderer: false,
      fileName: 'runtime-action-approval-queue.jsonl',
    },
  };
}

export function sanitizeRuntimeActionApprovalQueueItemsForPersistence(
  items: RuntimeActionApprovalQueueItem[],
): RuntimeActionApprovalQueueItem[] {
  return normalizeRuntimeActionApprovalQueueSourceItems(items);
}

export function validateRuntimeActionApprovalQueuePersistenceWrite(
  items: RuntimeActionApprovalQueueItem[],
): RuntimeActionApprovalQueuePersistenceWriteValidation {
  const retention = buildRuntimeActionApprovalQueuePersistenceContract().retention;
  const invalidItem = items.find(
    (item) => item.state !== 'awaiting_approval' || !item.canApprove || !item.canReject || !item.requiresNativeConfirmation,
  );

  if (invalidItem) {
    return {
      valid: false,
      reason: `Approval queue persistence only accepts awaiting_approval items that still require explicit native confirmation. Invalid item: ${invalidItem.correlationId}.`,
      itemCount: items.length,
      retention,
    };
  }

  return {
    valid: true,
    itemCount: items.length,
    retention,
  };
}

export function buildRuntimeActionApprovalQueueReadResult(input: {
  available: boolean;
  items: RuntimeActionApprovalQueueItem[];
  error?: string | null;
}): RuntimeActionApprovalQueueReadResult {
  if (!input.available || input.error) {
    return {
      schemaVersion: 1,
      status: 'unavailable',
      items: [],
      message: 'Runtime action approval queue storage is unavailable. Details were redacted for display.',
    };
  }

  const items = sanitizeRuntimeActionApprovalQueueItemsForPersistence(input.items);
  if (items.length === 0) {
    return {
      schemaVersion: 1,
      status: 'empty',
      items: [],
      message: 'No runtime action approval requests have been recorded yet. Conductor will not show fake approvals.',
    };
  }

  return {
    schemaVersion: 1,
    status: 'ready',
    items,
    message: 'Runtime action approval queue was read from local desktop storage.',
  };
}
