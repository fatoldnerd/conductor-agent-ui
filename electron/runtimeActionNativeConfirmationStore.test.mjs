import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import store from './runtimeActionNativeConfirmationStore.cjs';

const {
  appendRuntimeActionNativeConfirmationResults,
  readRuntimeActionNativeConfirmations,
  setRuntimeActionNativeConfirmationPath,
  __unsafeWriteRawForTest,
} = store;

function confirmation(overrides = {}) {
  return {
    schemaVersion: 1,
    status: 'confirmed_no_execution',
    correlationId: 'native-history-001',
    confirmedAt: '2026-05-06T18:00:00.000Z',
    runtimeId: 'codex-cli',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    nativeConfirmation: {
      required: true,
      shown: true,
      confirmed: true,
      implemented: true,
      reason: 'Native confirmation accepted for /Users/brad/private token=secret',
    },
    execution: {
      rendererCanExecute: false,
      executed: false,
      reason: 'Execution is not implemented for /root/secret api_key=hidden',
    },
    message: 'Native confirmation completed. No action executed.',
    ...overrides,
  };
}

describe('runtime action native confirmation store', () => {
  beforeEach(() => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'conductor-native-confirmation-store-'));
    setRuntimeActionNativeConfirmationPath(path.join(dir, 'native-confirmations.jsonl'));
  });

  it('persists and reads sanitized native confirmation outcomes newest first', () => {
    appendRuntimeActionNativeConfirmationResults([
      confirmation({ correlationId: 'older-confirmation', confirmedAt: '2026-05-06T17:00:00.000Z' }),
      confirmation({ correlationId: 'newer-confirmation', status: 'cancelled_no_execution', confirmedAt: '2026-05-06T18:00:00.000Z', nativeConfirmation: { required: true, shown: true, confirmed: false, implemented: true, reason: 'Cancelled at dialog' } }),
    ]);

    const result = readRuntimeActionNativeConfirmations();

    expect(result).toMatchObject({ schemaVersion: 1, status: 'ready', message: expect.stringContaining('local desktop storage') });
    expect(result.confirmations.map((entry) => entry.correlationId)).toEqual(['newer-confirmation', 'older-confirmation']);
    expect(JSON.stringify(result)).not.toContain('/Users/brad/private');
    expect(JSON.stringify(result)).not.toContain('token=secret');
    expect(JSON.stringify(result)).not.toContain('/root/secret');
    expect(JSON.stringify(result)).not.toContain('api_key=hidden');
    expect(result.confirmations.every((entry) => entry.execution.executed === false && entry.execution.rendererCanExecute === false)).toBe(true);
  });

  it('rejects executable-looking confirmation outcomes', () => {
    expect(() => appendRuntimeActionNativeConfirmationResults([
      confirmation({ execution: { rendererCanExecute: true, executed: true, reason: 'run it' } }),
    ])).toThrow(/non-executing/);
  });

  it('skips corrupt rows and fails closed on unavailable storage reads', () => {
    __unsafeWriteRawForTest(`${JSON.stringify(confirmation({ correlationId: 'valid-row' }))}\nnot-json\n`);

    expect(readRuntimeActionNativeConfirmations()).toMatchObject({
      status: 'ready',
      confirmations: [expect.objectContaining({ correlationId: 'valid-row' })],
    });
  });
});
