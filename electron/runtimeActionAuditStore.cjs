const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const UNSAFE_MARKERS = [
  'command',
  'stderr',
  'token',
  '/Users/',
  '/home/',
  'bash -lc',
  'secret',
];

const REQUIRED_EVENT_FIELDS = [
  'schemaVersion',
  'eventType',
  'occurredAt',
  'correlationId',
  'runtimeId',
  'actionKind',
  'source',
  'submitState',
  'outcome',
  'safeForLog',
  'redactedFields',
];

let runtimeActionAuditLogPath = process.env.CONDUCTOR_RUNTIME_ACTION_AUDIT_LOG
  || path.join(os.tmpdir(), 'conductor-runtime-action-audit.jsonl');

function setRuntimeActionAuditLogPath(nextPath) {
  if (typeof nextPath !== 'string' || nextPath.trim().length === 0) {
    throw new Error('Runtime action audit log path must be a non-empty string');
  }
  runtimeActionAuditLogPath = nextPath;
}

function appendRuntimeActionAuditEvents(events) {
  if (!Array.isArray(events)) throw new Error('Runtime action audit append requires an array of events');
  const sanitized = events.map((event) => sanitizeRuntimeActionAuditEventForStore(assertValidAuditEvent(event)));
  if (sanitized.length === 0) return buildReadResult([]);

  fs.mkdirSync(path.dirname(runtimeActionAuditLogPath), { recursive: true });
  const lines = sanitized.map((event) => JSON.stringify(event)).join('\n');
  fs.appendFileSync(runtimeActionAuditLogPath, `${lines}\n`, 'utf8');
  return buildReadResult(readEventsFromDisk());
}

function readRuntimeActionAuditHistory() {
  try {
    if (!fs.existsSync(runtimeActionAuditLogPath)) return buildReadResult([]);
    return buildReadResult(readEventsFromDisk());
  } catch {
    return {
      schemaVersion: 1,
      status: 'unavailable',
      events: [],
      message: 'Audit history storage is unavailable. Details were redacted for display.',
    };
  }
}

function readEventsFromDisk() {
  const content = fs.readFileSync(runtimeActionAuditLogPath, 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseAuditEventLine)
    .filter(Boolean)
    .map((event) => sanitizeRuntimeActionAuditEventForStore(event))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

function parseAuditEventLine(line) {
  try {
    return assertValidAuditEvent(JSON.parse(line));
  } catch {
    return null;
  }
}

function buildReadResult(events) {
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

function assertValidAuditEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('Invalid runtime action audit event: expected object');
  }
  for (const field of REQUIRED_EVENT_FIELDS) {
    if (!(field in event)) throw new Error(`Invalid runtime action audit event: missing ${field}`);
  }
  if (event.schemaVersion !== 1) throw new Error('Invalid runtime action audit event: unsupported schemaVersion');
  if (!Array.isArray(event.redactedFields)) throw new Error('Invalid runtime action audit event: redactedFields must be an array');
  return event;
}

function sanitizeRuntimeActionAuditEventForStore(event) {
  const redactedFields = [...event.redactedFields];
  let next = { ...event };

  if (!event.safeForLog || containsUnsafeMarker(event.reason)) {
    if (event.reason) {
      next.reason = '[redacted]';
      redactedFields.push('reason');
    }
  }

  if (!event.safeForLog || containsUnsafeMarker(event.payloadSummary)) {
    if (event.payloadSummary) {
      next.payloadSummary = '[redacted]';
      redactedFields.push('payloadSummary');
    }
  }

  if (!event.safeForLog || containsUnsafeMarker(event.resultMessage)) {
    if (event.resultMessage) {
      next.resultMessage = '[redacted]';
      redactedFields.push('resultMessage');
    }
  }

  return {
    ...next,
    safeForLog: true,
    redactedFields: [...new Set(redactedFields)],
  };
}

function containsUnsafeMarker(value) {
  if (!value) return false;
  const lower = String(value).toLowerCase();
  return UNSAFE_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

function __unsafeWriteRawForTest(content) {
  fs.mkdirSync(path.dirname(runtimeActionAuditLogPath), { recursive: true });
  fs.writeFileSync(runtimeActionAuditLogPath, content, 'utf8');
}

module.exports = {
  appendRuntimeActionAuditEvents,
  readRuntimeActionAuditHistory,
  setRuntimeActionAuditLogPath,
  __unsafeWriteRawForTest,
};
