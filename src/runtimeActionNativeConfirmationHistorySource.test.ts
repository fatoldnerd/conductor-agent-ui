import { describe, expect, it } from 'vitest';
import {
  buildRuntimeActionNativeConfirmationHistorySourceState,
  buildRuntimeActionNativeConfirmationHistoryViewModel,
} from './runtimeActionNativeConfirmationHistorySource';

function confirmation(overrides = {}) {
  return {
    schemaVersion: 1 as const,
    status: 'confirmed_no_execution' as const,
    correlationId: 'native-history-source-1',
    confirmedAt: '2026-05-06T18:00:00.000Z',
    runtimeId: 'codex-cli',
    actionKind: 'health_check',
    source: 'agent-runtimes',
    nativeConfirmation: {
      required: true,
      shown: true,
      confirmed: true,
      implemented: true,
      reason: 'Confirmed after reviewing /Users/brad/private token=secret',
    },
    execution: {
      rendererCanExecute: false,
      executed: false,
      reason: 'Execution is not implemented.',
    },
    message: 'Native confirmation completed. No action executed.',
    ...overrides,
  };
}

describe('runtime action native confirmation history source', () => {
  it('keeps browser mode truthful with no fake confirmations', () => {
    const source = buildRuntimeActionNativeConfirmationHistorySourceState({ desktopBridgeAvailable: false });

    expect(source).toMatchObject({
      schemaVersion: 1,
      status: 'desktop_required',
      sourceKind: 'none',
      canRead: false,
      confirmations: [],
      viewModel: { empty: true, entries: [] },
    });
    expect(source.message).toContain('desktop app');
  });

  it('normalizes read results into a sanitized no-execution view model', () => {
    const source = buildRuntimeActionNativeConfirmationHistorySourceState({
      desktopBridgeAvailable: true,
      sourceKind: 'electron-local',
      confirmations: {
        schemaVersion: 1,
        status: 'ready',
        confirmations: [
          confirmation({ correlationId: 'confirmed', confirmedAt: '2026-05-06T18:00:00.000Z' }),
          confirmation({ correlationId: 'cancelled', status: 'cancelled_no_execution', confirmedAt: '2026-05-06T18:01:00.000Z', nativeConfirmation: { required: true, shown: true, confirmed: false, implemented: true, reason: 'Cancelled' } }),
        ],
        message: 'read',
      },
    });

    expect(source.status).toBe('ready');
    expect(source.viewModel.stats).toEqual({ total: 2, confirmed: 1, cancelled: 1, invalid: 0 });
    expect(source.viewModel.entries.map((entry) => entry.correlationId)).toEqual(['cancelled', 'confirmed']);
    expect(source.viewModel.entries[0]).toMatchObject({ title: 'Native confirmation cancelled', tone: 'muted', executionNote: 'No action executed.' });
    expect(JSON.stringify(source)).not.toContain('/Users/brad/private');
    expect(JSON.stringify(source)).not.toContain('token=secret');
  });

  it('rejects unsafe executable-looking source data', () => {
    const vm = buildRuntimeActionNativeConfirmationHistoryViewModel([
      confirmation({ execution: { rendererCanExecute: true, executed: true, reason: 'bad' } }),
    ]);

    expect(vm).toMatchObject({ empty: true, entries: [], stats: { total: 0, confirmed: 0, cancelled: 0, invalid: 0 } });
  });
});
