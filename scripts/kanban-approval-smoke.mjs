import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const workspace = process.cwd();
const artifactRoot = path.join(workspace, 'artifact');
const outDir = path.join(workspace, 'smoke-report');
fs.mkdirSync(outDir, { recursive: true });

function sh(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function findApp(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name === 'Conductor.app') return full;
    if (entry.isDirectory()) {
      const nested = findApp(full);
      if (nested) return nested;
    }
  }
  return null;
}

function queueItem(overrides) {
  return {
    schemaVersion: 1,
    state: 'awaiting_approval',
    correlationId: overrides.correlationId,
    runtimeId: 'codex-cli',
    actionKind: 'health_check',
    source: 'kanban-smoke-test',
    desktopApi: 'runtime.runHealthCheck',
    riskLevel: 'low',
    requestedAt: overrides.requestedAt,
    requestedSummary: overrides.requestedSummary,
    approvalPrompt: overrides.approvalPrompt,
    canApprove: true,
    canReject: true,
    requiresNativeConfirmation: true,
    guardrails: [
      'Renderer must not execute arbitrary shell commands.',
      'Approved decisions require native confirmation before execution.',
      'This smoke request must not run a real runtime action.',
    ],
    auditPreview: [{
      schemaVersion: 1,
      eventType: 'requested_approval',
      occurredAt: overrides.requestedAt,
      correlationId: overrides.correlationId,
      runtimeId: 'codex-cli',
      actionKind: 'health_check',
      source: 'kanban-smoke-test',
      payloadSummary: 'Smoke test approval request',
      reason: 'Approval queue smoke test fixture',
      safeForLog: true,
      redactedFields: [],
    }],
  };
}

const appPath = findApp(artifactRoot);
if (!appPath) throw new Error(`Conductor.app not found under ${artifactRoot}`);
const exePath = path.join(appPath, 'Contents/MacOS/Conductor');
const userData = path.join(process.env.HOME, 'Library/Application Support/Conductor');
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const queuePath = path.join(userData, 'runtime-action-approval-queue.jsonl');
const decisionPath = path.join(userData, 'runtime-action-approval-decisions.jsonl');
const confirmationPath = path.join(userData, 'runtime-action-native-confirmations.jsonl');
const auditPath = path.join(userData, 'runtime-action-audit.jsonl');

const seededItems = [
  queueItem({
    correlationId: 'kanban-approve-001',
    requestedAt: '2026-05-19T10:00:00.000Z',
    requestedSummary: 'Codex CLI health check approval request for smoke testing.',
    approvalPrompt: 'Approve Codex CLI health check? This smoke test must still require native confirmation and must not execute a real runtime action.',
  }),
  queueItem({
    correlationId: 'kanban-reject-001',
    requestedAt: '2026-05-19T10:01:00.000Z',
    requestedSummary: 'Codex CLI rejected decision request for smoke testing.',
    approvalPrompt: 'Reject this smoke approval request to verify terminal no-execution behavior.',
  }),
];
fs.writeFileSync(queuePath, seededItems.map((item) => JSON.stringify(item)).join('\n') + '\n', 'utf8');

try { sh('xattr', ['-dr', 'com.apple.quarantine', appPath]); } catch {}
try { fs.chmodSync(exePath, 0o755); } catch {}

const port = 9223;
const app = spawn(exePath, [`--remote-debugging-port=${port}`], {
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stdout = '';
let stderr = '';
app.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
app.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
process.on('exit', () => { try { app.kill('SIGTERM'); } catch {} });

async function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}
async function waitForTarget() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Timed out waiting for CDP target. stdout=${stdout} stderr=${stderr}`);
}

class Cdp {
  constructor(ws) { this.ws = ws; this.nextId = 1; this.pending = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const cdp = new Cdp(ws);
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && cdp.pending.has(msg.id)) {
        const { resolve, reject } = cdp.pending.get(msg.id);
        cdp.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
    return cdp;
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

const cdp = await Cdp.connect(await waitForTarget());
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await sleep(3000);

async function evalJs(expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function clickButtonByText(text, occurrence = 0) {
  return evalJs(`(() => {
    const buttons = [...document.querySelectorAll('button')].filter((button) => button.innerText.trim().includes(${JSON.stringify(text)}));
    const button = buttons[${occurrence}];
    if (!button) return { ok: false, available: buttons.map((button) => button.innerText.trim()) };
    button.scrollIntoView({ block: 'center', inline: 'center' });
    button.click();
    return { ok: true, text: button.innerText.trim(), disabled: button.disabled };
  })()`);
}
async function bodyText() {
  return evalJs('document.body.innerText');
}
async function screenshot(name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
  return file;
}
function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) throw new Error(`Missing ${label}: ${expected}\n---body---\n${text.slice(0, 5000)}`);
}

const nav = await clickButtonByText('Activity');
if (!nav.ok) throw new Error(`Activity nav not found: ${JSON.stringify(nav)}`);
await sleep(2500);
let text = await bodyText();
assertIncludes(text, 'Approval queue', 'approval queue heading');
assertIncludes(text, 'Approval decisions', 'approval decisions heading');
assertIncludes(text, 'Native confirmations', 'native confirmations heading');
assertIncludes(text, 'Codex CLI health check approval request', 'seeded approve queue item');
assertIncludes(text, 'Codex CLI rejected decision request', 'seeded reject queue item');
assertIncludes(text, 'No command executes from these controls', 'safe decision copy');
const initialScreenshot = await screenshot('activity-approval-queue-initial');

const rejectResult = await clickButtonByText('Reject');
if (!rejectResult.ok || rejectResult.disabled) throw new Error(`Reject button failed: ${JSON.stringify(rejectResult)}`);
await sleep(2500);
text = await bodyText();
assertIncludes(text, 'Last decision recorded', 'reject decision submit message');
assertIncludes(text, 'rejected', 'rejected decision visible');
const rejectScreenshot = await screenshot('activity-after-reject');

const approveResult = await clickButtonByText('Approve');
if (!approveResult.ok || approveResult.disabled) throw new Error(`Approve button failed: ${JSON.stringify(approveResult)}`);
await sleep(1500);
let osascriptResult = { ok: false, output: '' };
try {
  const output = sh('osascript', ['-e', 'tell application "System Events"', '-e', 'tell process "Conductor"', '-e', 'click button "Confirm" of window 1', '-e', 'end tell', '-e', 'end tell']);
  osascriptResult = { ok: true, output };
} catch (error) {
  osascriptResult = { ok: false, output: String(error.stderr || error.message || error) };
  // Try keyboard path as fallback. The dialog default is Cancel, so tab to Confirm then Space.
  try { sh('osascript', ['-e', 'tell application "System Events" to key code 48', '-e', 'delay 0.2', '-e', 'tell application "System Events" to key code 49']); } catch {}
}
await sleep(3000);
text = await bodyText();
assertIncludes(text, 'approved', 'approved decision visible');
assertIncludes(text, 'No action executed', 'native confirmation no-execution visible');
const approveScreenshot = await screenshot('activity-after-approve-confirm');

const decisionsRaw = fs.existsSync(decisionPath) ? fs.readFileSync(decisionPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
const confirmationsRaw = fs.existsSync(confirmationPath) ? fs.readFileSync(confirmationPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
const auditsRaw = fs.existsSync(auditPath) ? fs.readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
if (decisionsRaw.length !== 2) throw new Error(`Expected 2 decisions, found ${decisionsRaw.length}`);
if (!decisionsRaw.every((entry) => entry.execution?.rendererCanExecute === false)) throw new Error('A decision allowed renderer execution');
if (!decisionsRaw.some((entry) => entry.decision?.decision === 'approved' && entry.execution?.requiresNativeConfirmation === true)) throw new Error('Approved decision did not require native confirmation');
if (!decisionsRaw.some((entry) => entry.decision?.decision === 'rejected' && entry.execution?.requiresNativeConfirmation === false)) throw new Error('Rejected decision was not terminal');
if (confirmationsRaw.length < 1) throw new Error('Expected at least one native confirmation record');
if (!confirmationsRaw.every((entry) => entry.execution?.rendererCanExecute === false && entry.execution?.executed === false)) throw new Error('A native confirmation reported executable behavior');
if (!confirmationsRaw.some((entry) => entry.status === 'confirmed_no_execution')) throw new Error('No confirmed_no_execution native confirmation found');

const summary = {
  appPath,
  userData,
  initialScreenshot,
  rejectScreenshot,
  approveScreenshot,
  queueSeeded: seededItems.length,
  decisions: decisionsRaw.map((entry) => ({ correlationId: entry.correlationId, decision: entry.decision?.decision, state: entry.state, execution: entry.execution })),
  confirmations: confirmationsRaw.map((entry) => ({ correlationId: entry.correlationId, status: entry.status, execution: entry.execution, nativeConfirmation: entry.nativeConfirmation })),
  auditEventCount: auditsRaw.length,
  osascriptResult,
  stdout: stdout.slice(-2000),
  stderr: stderr.slice(-2000),
};
fs.writeFileSync(path.join(outDir, 'approval-smoke-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
app.kill('SIGTERM');
