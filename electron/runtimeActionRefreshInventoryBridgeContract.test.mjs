import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const preloadSource = readFileSync(resolve('electron/preload.cjs'), 'utf8');
const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');

describe('runtime action refresh inventory bridge contract', () => {
  it('exposes a narrow refreshInventory runtime action without generic execute', () => {
    expect(preloadSource).toContain('refreshInventory');
    expect(preloadSource).toContain("ipcRenderer.invoke('runtimeActions:refreshInventory')");
    expect(preloadSource).toContain('openDocumentation');
    expect(preloadSource).toContain("ipcRenderer.invoke('runtimeActions:openDocumentation'");
    expect(preloadSource).not.toContain('runtimeActions:execute');
    expect(preloadSource).not.toContain('executeRuntimeAction');
  });

  it('registers a trusted sender main handler using the allowlisted registry', () => {
    expect(mainSource).toContain("ipcMain.handle('runtimeActions:refreshInventory'");
    expect(mainSource).toContain("ipcMain.handle('runtimeActions:openDocumentation'");
    expect(mainSource).toContain('executeAllowlistedRuntimeAction');
    expect(mainSource).toContain("desktopApi: 'runtime.refreshInventory'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:execute'");
  });
});
