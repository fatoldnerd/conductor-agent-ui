import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const preloadSource = readFileSync(resolve('electron/preload.cjs'), 'utf8');
const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');

describe('runtime action approval queue preload contract', () => {
  it('exposes a read-only runtimeActions approval queue method', () => {
    expect(preloadSource).toContain('runtimeActions');
    expect(preloadSource).toContain('getApprovalQueue');
    expect(preloadSource).toContain("ipcRenderer.invoke('runtimeActions:getApprovalQueue')");
    expect(preloadSource).not.toContain('approveRuntimeAction');
    expect(preloadSource).not.toContain('rejectRuntimeAction');
    expect(preloadSource).not.toContain('writeApproval');
  });

  it('registers the queue read handler in main without approve or reject channels', () => {
    expect(mainSource).toContain("ipcMain.handle('runtimeActions:getApprovalQueue'");
    expect(mainSource).toContain('readRuntimeActionApprovalQueue');
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:approve'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:reject'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:writeApproval'");
  });
});
