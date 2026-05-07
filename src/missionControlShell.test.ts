import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('Mission Control empty shell', () => {
  it('promotes Workflows into a Mission Control shell without fake execution', () => {
    expect(appSource).toContain("workflows: { title: 'Mission Control'");
    expect(appSource).toContain("{ id: 'workflows', label: 'Mission Control'");
    expect(appSource).toContain('function MissionControlView()');
    expect(appSource).toContain('No mission execution engine connected yet');
    expect(appSource).toContain('Mission goal');
    expect(appSource).toContain('Agent readiness');
    expect(appSource).toContain('Approvals required');
    expect(appSource).toContain('Mission timeline');
  });

  it('keeps Mission Control non-executing and honest', () => {
    expect(appSource).toContain('Create mission disabled');
    expect(appSource).toContain('No fake missions are rendered');
    expect(appSource).toContain('Mission execution is parked until an allowlisted local mission runner exists.');
    expect(appSource).not.toContain('sampleMission');
    expect(appSource).not.toContain('fakeMission');
    expect(appSource).not.toContain('missionStatus:');
    expect(appSource).not.toContain('setInterval(');
  });
});
