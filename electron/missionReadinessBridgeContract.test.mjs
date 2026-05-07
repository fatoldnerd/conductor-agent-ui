import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(resolve(__dirname, 'main.cjs'), 'utf8');
const preloadSource = readFileSync(resolve(__dirname, 'preload.cjs'), 'utf8');

describe('Mission Control read-only repo inspection bridge', () => {
  it('exposes a narrow mission bridge without generic execution IPC', () => {
    expect(preloadSource).toContain('missions:');
    expect(preloadSource).toContain('inspectRepoReadiness: (projectPath)');
    expect(preloadSource).toContain("ipcRenderer.invoke('missions:inspectRepoReadiness', { projectPath })");
    expect(preloadSource).not.toContain('missions:execute');
    expect(preloadSource).not.toContain('ipcRenderer.send(');
  });

  it('registers trusted main-process IPC for read-only repo inspection only', () => {
    expect(mainSource).toContain("ipcMain.handle('missions:inspectRepoReadiness'");
    expect(mainSource).toContain('assertTrustedSender(event)');
    expect(mainSource).toContain('inspectRepoReadinessMission({ projectPath: payload?.projectPath })');
    expect(mainSource).not.toContain("ipcMain.handle('missions:execute'");
  });
});
