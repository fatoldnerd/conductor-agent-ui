import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('runtime action native confirmation history renderer contract', () => {
  it('loads and renders native confirmation history without fake data or execution', () => {
    expect(appSource).toContain('buildRuntimeActionNativeConfirmationHistorySourceState');
    expect(appSource).toContain('window.conductor.runtimeActions.getNativeConfirmations');
    expect(appSource).toContain('loadRuntimeActionNativeConfirmationHistory');
    expect(appSource).toContain('runtimeActionNativeConfirmationHistorySource.status');
    expect(appSource).toContain('Native confirmations');
    expect(appSource).toContain('No action executed');
    expect(appSource).not.toContain('runtimeActions.execute');
    expect(appSource).not.toContain('runtimeActions.runDesktopApi');
  });
});
