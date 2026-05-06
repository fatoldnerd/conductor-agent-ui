import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const preloadSource = readFileSync(resolve('electron/preload.cjs'), 'utf8');
const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');

describe('runtime action approval decision preload contract', () => {
  it('exposes a read-only runtimeActions approval decisions method', () => {
    expect(preloadSource).toContain('runtimeActions');
    expect(preloadSource).toContain('getApprovalDecisions');
    expect(preloadSource).toContain("ipcRenderer.invoke('runtimeActions:getApprovalDecisions')");
    expect(preloadSource).not.toContain('approveRuntimeAction');
    expect(preloadSource).not.toContain('rejectRuntimeAction');
    expect(preloadSource).not.toContain('appendApprovalDecision');
  });

  it('registers the decision read handler in main without approve or reject channels', () => {
    expect(mainSource).toContain("ipcMain.handle('runtimeActions:getApprovalDecisions'");
    expect(mainSource).toContain('readRuntimeActionApprovalDecisions');
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:approve'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:reject'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:appendApprovalDecision'");
  });
});
