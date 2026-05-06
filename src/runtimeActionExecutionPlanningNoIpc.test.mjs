import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');
const preloadSource = readFileSync(resolve('electron/preload.cjs'), 'utf8');
const contractSource = readFileSync(resolve('src/runtimeActionExecutionPlanningContract.ts'), 'utf8');

describe('runtime action execution planning no-IPC contract', () => {
  it('adds only a model contract and no runtime action execution bridge', () => {
    expect(contractSource).toContain('buildRuntimeActionExecutionPlanningContract');
    expect(contractSource).toContain('planning_preview_only');
    expect(contractSource).toContain('requiresSeparateImplementationApproval');
    expect(contractSource).toContain('executeMethod: null');
    expect(mainSource).not.toContain('runtimeActions:execute');
    expect(mainSource).not.toContain('runtimeActions:runDesktopApi');
    expect(mainSource).not.toContain('runtimeActions:executePlan');
    expect(preloadSource).not.toContain('executeRuntimeAction');
    expect(preloadSource).not.toContain('runDesktopApi');
    expect(preloadSource).not.toContain('executePlan');
  });
});
