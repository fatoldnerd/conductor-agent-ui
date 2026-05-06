import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const preloadSource = readFileSync(resolve('electron/preload.cjs'), 'utf8');
const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');

describe('runtime action approval decision submit bridge contract', () => {
  it('exposes only a typed approval decision submission method, not execution', () => {
    expect(preloadSource).toContain('submitApprovalDecision');
    expect(preloadSource).toContain("ipcRenderer.invoke('runtimeActions:submitApprovalDecision'");
    expect(preloadSource).not.toContain('executeRuntimeAction');
    expect(preloadSource).not.toContain('runApprovedRuntimeAction');
  });

  it('registers trusted-sender checked submit handler in main without native dialog or execution channels', () => {
    expect(mainSource).toContain("ipcMain.handle('runtimeActions:submitApprovalDecision'");
    expect(mainSource).toContain('submitRuntimeActionApprovalDecision');
    expect(mainSource).toContain('assertTrustedSender(event)');
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:execute'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:confirmNative'");
  });
});
