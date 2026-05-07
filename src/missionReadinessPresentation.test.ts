import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('Mission readiness presentation', () => {
  it('uses operator-friendly readiness labels instead of raw enum values', () => {
    expect(appSource).toContain('formatMissionReadinessLabel');
    expect(appSource).toContain('Ready for read-only agent review');
    expect(appSource).toContain('Needs attention before agent review');
    expect(appSource).not.toContain('missionResult.repoName}: {missionResult.summary.readiness}');
  });

  it('shows a readiness score and hides risk notes when none are present', () => {
    expect(appSource).toContain('missionReadinessScore');
    expect(appSource).toContain('Readiness score');
    expect(appSource).toContain('missionRiskNotes.length > 0');
    expect(appSource).toContain('No risk notes detected from allowlisted metadata.');
  });

  it('presents the next safe action as disabled preview only', () => {
    expect(appSource).toContain('Next safe action');
    expect(appSource).toContain('Generate review plan');
    expect(appSource).toContain('disabled>Preview only');
    expect(appSource).not.toContain('window.conductor?.missions?.generateReviewPlan');
    expect(appSource).not.toContain('missions:generateReviewPlan');
  });
});
