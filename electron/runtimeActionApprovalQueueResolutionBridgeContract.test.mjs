import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');

describe('runtime action approval queue resolution bridge contract', () => {
  it('resolves approval queue reads against recorded decisions before renderer display', () => {
    expect(mainSource).toContain("ipcMain.handle('runtimeActions:getApprovalQueue'");
    expect(mainSource).toContain('assertTrustedSender(event)');
    expect(mainSource).toContain('readRuntimeActionApprovalDecisions()');
    expect(mainSource).toContain('decisionReadResult');
    expect(mainSource).toContain('readRuntimeActionApprovalQueue({');
  });

  it('does not add native confirmation or execution while resolving queue lifecycle state', () => {
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:confirmNative'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:execute'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:runDesktopApi'");
  });
});
