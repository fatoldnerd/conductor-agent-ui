import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const preloadSource = readFileSync(resolve('electron/preload.cjs'), 'utf8');
const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');
const dialogSource = readFileSync(resolve('electron/runtimeActionNativeConfirmationDialog.cjs'), 'utf8');

describe('runtime action native confirmation history bridge contract', () => {
  it('exposes read-only native confirmation history through preload', () => {
    expect(preloadSource).toContain('getNativeConfirmations');
    expect(preloadSource).toContain("ipcRenderer.invoke('runtimeActions:getNativeConfirmations')");
    expect(preloadSource).not.toContain('executeRuntimeAction');
    expect(preloadSource).not.toContain('runDesktopApi');
  });

  it('registers trusted main read handler and persists dialog outcomes without execution', () => {
    expect(mainSource).toContain("ipcMain.handle('runtimeActions:getNativeConfirmations'");
    expect(mainSource).toContain('readRuntimeActionNativeConfirmations');
    expect(mainSource).toContain('setRuntimeActionNativeConfirmationPath');
    expect(mainSource).toContain('runtime-action-native-confirmations.jsonl');
    expect(mainSource).toContain('assertTrustedSender(event)');
    expect(dialogSource).toContain('appendRuntimeActionNativeConfirmationResults');
    expect(dialogSource).not.toContain('execFile');
    expect(dialogSource).not.toContain('spawn(');
  });
});
