import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const preloadSource = readFileSync(resolve('electron/preload.cjs'), 'utf8');
const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');

describe('runtime action native confirmation dialog bridge contract', () => {
  it('exposes a narrow native confirmation bridge without execution APIs', () => {
    expect(preloadSource).toContain('confirmNativeApprovalDecision');
    expect(preloadSource).toContain("ipcRenderer.invoke('runtimeActions:confirmNativeApprovalDecision', payload)");
    expect(preloadSource).not.toContain('executeRuntimeAction');
    expect(preloadSource).not.toContain('runDesktopApi');
  });

  it('registers an Electron-main native confirmation handler with trusted sender checks', () => {
    expect(mainSource).toContain("ipcMain.handle('runtimeActions:confirmNativeApprovalDecision'");
    expect(mainSource).toContain('assertTrustedSender(event)');
    expect(mainSource).toContain('confirmRuntimeActionNativeConfirmation');
    expect(mainSource).toContain('dialog.showMessageBox');
    expect(mainSource).toContain('BrowserWindow.fromWebContents(event.sender)');
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:execute'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:runDesktopApi'");
  });
});
