import { redactRuntimeActionAuditEvent, type RuntimeActionAuditEvent } from './runtimeActionAuditLog';

export type RuntimeActionAuditPersistenceOwner = 'electron_main';
export type RuntimeActionAuditPersistenceStorageKind = 'local_jsonl';
export type RuntimeActionAuditPersistenceAppendMode = 'append_only';

export type RuntimeActionAuditRetentionPolicy = {
  maxEvents: number;
  maxAgeDays: number;
  redactionRequired: true;
};

export type RuntimeActionAuditPersistenceContract = {
  schemaVersion: 1;
  owner: RuntimeActionAuditPersistenceOwner;
  storageKind: RuntimeActionAuditPersistenceStorageKind;
  appendMode: RuntimeActionAuditPersistenceAppendMode;
  retention: RuntimeActionAuditRetentionPolicy;
  rendererAccess: {
    canRead: true;
    canAppend: false;
    canMutate: false;
    reason: string;
  };
  preloadApi: {
    readMethod: 'runtimeActions.getAuditHistory';
    appendMethod: null;
  };
  storagePathPolicy: {
    kind: 'app_user_data';
    exposesAbsolutePathToRenderer: false;
    fileName: 'runtime-action-audit.jsonl';
  };
};

export type RuntimeActionAuditPersistenceWriteValidation =
  | {
      valid: true;
      eventCount: number;
      retention: RuntimeActionAuditRetentionPolicy;
    }
  | {
      valid: false;
      reason: string;
      eventCount: number;
      retention: RuntimeActionAuditRetentionPolicy;
    };

export type RuntimeActionAuditPersistenceReadStatus = 'unavailable' | 'empty' | 'ready';

export type RuntimeActionAuditPersistenceReadResult = {
  schemaVersion: 1;
  status: RuntimeActionAuditPersistenceReadStatus;
  events: RuntimeActionAuditEvent[];
  message: string;
};

const DEFAULT_RETENTION: RuntimeActionAuditRetentionPolicy = {
  maxEvents: 5_000,
  maxAgeDays: 90,
  redactionRequired: true,
};

export function buildRuntimeActionAuditPersistenceContract(): RuntimeActionAuditPersistenceContract {
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
      reason: 'The renderer may request sanitized audit history, but Electron main owns append and mutation operations.',
    },
    preloadApi: {
      readMethod: 'runtimeActions.getAuditHistory',
      appendMethod: null,
    },
    storagePathPolicy: {
      kind: 'app_user_data',
      exposesAbsolutePathToRenderer: false,
      fileName: 'runtime-action-audit.jsonl',
    },
  };
}

export function sanitizeRuntimeActionAuditEventsForPersistence(events: RuntimeActionAuditEvent[]): RuntimeActionAuditEvent[] {
  return events.map((event) => redactRuntimeActionAuditEvent(event));
}

export function validateRuntimeActionAuditPersistenceWrite(events: RuntimeActionAuditEvent[]): RuntimeActionAuditPersistenceWriteValidation {
  const retention = buildRuntimeActionAuditPersistenceContract().retention;
  const unsafeEvent = events.find((event) => !event.safeForLog);
  if (unsafeEvent) {
    return {
      valid: false,
      reason: `Audit event ${unsafeEvent.correlationId} is not safeForLog and must be redacted before persistence.`,
      eventCount: events.length,
      retention,
    };
  }

  return {
    valid: true,
    eventCount: events.length,
    retention,
  };
}

export function buildRuntimeActionAuditPersistenceReadResult(input: {
  available: boolean;
  events: RuntimeActionAuditEvent[];
  error?: string | null;
}): RuntimeActionAuditPersistenceReadResult {
  if (!input.available || input.error) {
    return {
      schemaVersion: 1,
      status: 'unavailable',
      events: [],
      message: 'Audit history storage is unavailable. Details were redacted for display.',
    };
  }

  const events = sanitizeRuntimeActionAuditEventsForPersistence(input.events);
  if (events.length === 0) {
    return {
      schemaVersion: 1,
      status: 'empty',
      events: [],
      message: 'No runtime action audit events have been recorded yet. Conductor will not show fake history.',
    };
  }

  return {
    schemaVersion: 1,
    status: 'ready',
    events,
    message: 'Runtime action audit history was read from local desktop storage.',
  };
}
