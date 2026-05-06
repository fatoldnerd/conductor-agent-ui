import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');
const preloadSource = readFileSync(resolve('electron/preload.cjs'), 'utf8');
const contractSource = readFileSync(resolve('src/runtimeActionAllowlistedHandlerRegistryContract.ts'), 'utf8');

describe('runtime action handler registry no-IPC contract', () => {
  it('adds no runtime action handler registry or execution IPC bridge', () => {
    expect(contractSource).toContain('buildRuntimeActionAllowlistedHandlerRegistryContract');
    expect(contractSource).toContain('planned_not_implemented');
    expect(contractSource).toContain('executeChannel: null');
    expect(contractSource).toContain('registerChannel: null');
    expect(mainSource).not.toContain('runtimeActions:registerHandler');
    expect(mainSource).not.toContain('runtimeActions:executeHandler');
    expect(mainSource).not.toContain('runtimeActions:execute');
    expect(mainSource).not.toContain('runtimeActions:runDesktopApi');
    expect(preloadSource).not.toContain('registerRuntimeActionHandler');
    expect(preloadSource).not.toContain('executeRuntimeActionHandler');
    expect(preloadSource).not.toContain('runDesktopApi');
  });
});
