const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const UNSAFE_PATTERNS = [
  /\b(token|secret|api[_-]?key|password)\s*=\s*[^\s,;]+/gi,
  /\/Users\/[^\s,;]+/g,
  /\/home\/[^\s,;]+/g,
  /\/root\/[^\s,;]+/g,
];

const REQUIRED_QUEUE_FIELDS = [
  'schemaVersion',
  'state',
  'correlationId',
  'runtimeId',
  'actionKind',
  'source',
  'desktopApi',
  'riskLevel',
  'requestedAt',
  'requestedSummary',
  'approvalPrompt',
  'canApprove',
  'canReject',
  'requiresNativeConfirmation',
  'guardrails',
  'auditPreview',
];

let runtimeActionApprovalQueuePath = process.env.CONDUCTOR_RUNTIME_ACTION_APPROVAL_QUEUE
  || path.join(os.tmpdir(), 'conductor-runtime-action-approval-queue.jsonl');

function setRuntimeActionApprovalQueuePath(nextPath) {
  if (typeof nextPath !== 'string' || nextPath.trim().length === 0) {
    throw new Error('Runtime action approval queue path must be a non-empty string');
  }
  runtimeActionApprovalQueuePath = nextPath;
}

function appendRuntimeActionApprovalQueueItems(items) {
  if (!Array.isArray(items)) throw new Error('Runtime action approval queue append requires an array of items');
  const sanitized = items.map((item) => sanitizeRuntimeActionApprovalQueueItemForStore(assertValidQueueItem(item)));
  const invalid = sanitized.find((item) => item.state !== 'awaiting_approval' || !item.canApprove || !item.canReject || !item.requiresNativeConfirmation);
  if (invalid) throw new Error(`Runtime action approval queue persistence only accepts awaiting_approval items: ${invalid.correlationId}`);
  if (sanitized.length === 0) return buildReadResult([]);

  fs.mkdirSync(path.dirname(runtimeActionApprovalQueuePath), { recursive: true });
  const lines = sanitized.map((item) => JSON.stringify(item)).join('\n');
  fs.appendFileSync(runtimeActionApprovalQueuePath, `${lines}\n`, 'utf8');
  return buildReadResult(readItemsFromDisk());
}

function readRuntimeActionApprovalQueue() {
  try {
    if (!fs.existsSync(runtimeActionApprovalQueuePath)) return buildReadResult([]);
    return buildReadResult(readItemsFromDisk());
  } catch {
    return {
      schemaVersion: 1,
      status: 'unavailable',
      items: [],
      message: 'Runtime action approval queue storage is unavailable. Details were redacted for display.',
    };
  }
}

function readItemsFromDisk() {
  const content = fs.readFileSync(runtimeActionApprovalQueuePath, 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseQueueItemLine)
    .filter(Boolean)
    .map((item) => sanitizeRuntimeActionApprovalQueueItemForStore(item))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

function parseQueueItemLine(line) {
  try {
    return assertValidQueueItem(JSON.parse(line));
  } catch {
    return null;
  }
}

function buildReadResult(items) {
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

function assertValidQueueItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('Invalid runtime action approval queue item: expected object');
  }
  for (const field of REQUIRED_QUEUE_FIELDS) {
    if (!(field in item)) throw new Error(`Invalid runtime action approval queue item: missing ${field}`);
  }
  if (item.schemaVersion !== 1) throw new Error('Invalid runtime action approval queue item: unsupported schemaVersion');
  if (!Array.isArray(item.guardrails)) throw new Error('Invalid runtime action approval queue item: guardrails must be an array');
  if (!Array.isArray(item.auditPreview)) throw new Error('Invalid runtime action approval queue item: auditPreview must be an array');
  return item;
}

function sanitizeRuntimeActionApprovalQueueItemForStore(item) {
  return {
    ...item,
    requestedSummary: redactText(item.requestedSummary),
    approvalPrompt: redactText(item.approvalPrompt),
    guardrails: item.guardrails.map((guardrail) => redactText(guardrail)),
  };
}

function redactText(value) {
  return UNSAFE_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), String(value));
}

function __unsafeWriteRawForTest(content) {
  fs.mkdirSync(path.dirname(runtimeActionApprovalQueuePath), { recursive: true });
  fs.writeFileSync(runtimeActionApprovalQueuePath, content, 'utf8');
}

module.exports = {
  appendRuntimeActionApprovalQueueItems,
  readRuntimeActionApprovalQueue,
  setRuntimeActionApprovalQueuePath,
  __unsafeWriteRawForTest,
};
