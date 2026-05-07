import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';
import electronTypesSource from './electron.d.ts?raw';

describe('Mission Control read-only repo inspection UI', () => {
  it('wires the first mission type through the narrow desktop mission bridge', () => {
    expect(appSource).toContain('Read-only repo readiness inspection');
    expect(appSource).toContain('missionRepoPath');
    expect(appSource).toContain('window.conductor?.missions?.inspectRepoReadiness');
    expect(appSource).toContain('rendererCanExecuteArbitraryActions');
    expect(appSource).not.toContain('missions.execute');
    expect(appSource).not.toContain('missions:execute');
  });

  it('declares a typed mission bridge without arbitrary command fields', () => {
    expect(electronTypesSource).toContain('MissionRepoReadinessResult');
    expect(electronTypesSource).toContain('inspectRepoReadiness: (projectPath: string) => Promise<MissionRepoReadinessResult>');
    expect(electronTypesSource).toContain('commandAllowlist: []');
    expect(electronTypesSource).not.toContain('missionCommand');
  });
});
