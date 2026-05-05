import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const preloadSource = readFileSync(resolve('electron/preload.cjs'), 'utf8');
const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');

describe('runtime action audit history preload contract', () => {
  it('exposes a read-only runtimeActions audit history method', () => {
    expect(preloadSource).toContain('runtimeActions');
    expect(preloadSource).toContain('getAuditHistory');
    expect(preloadSource).toContain("ipcRenderer.invoke('runtimeActions:getAuditHistory')");
    expect(preloadSource).not.toContain('appendAudit');
    expect(preloadSource).not.toContain('writeAudit');
  });

  it('registers the read handler in main without a renderer-write channel', () => {
    expect(mainSource).toContain("ipcMain.handle('runtimeActions:getAuditHistory'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:appendAudit'");
    expect(mainSource).not.toContain("ipcMain.handle('runtimeActions:writeAudit'");
  });
});
