import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('Mission Control repo review discoverability', () => {
  it('places the approved repo review action directly in the successful readiness result', () => {
    const readinessResultIndex = appSource.indexOf('missionResult && (');
    const reviewButtonIndex = appSource.indexOf('Start approved repo review', readinessResultIndex);
    const separateNextSafeActionIndex = appSource.indexOf('<span className="eyebrow">Next safe action</span>');

    expect(readinessResultIndex).toBeGreaterThan(-1);
    expect(reviewButtonIndex).toBeGreaterThan(readinessResultIndex);
    expect(separateNextSafeActionIndex).toBe(-1);
  });

  it('keeps native approval and fixed Codex read-only safety copy beside the action', () => {
    expect(appSource).toContain('Native approval required. Fixed runtime: Codex CLI read-only.');
    expect(appSource).toContain('Native approval required. No generic mission execution channel.');
    expect(appSource).not.toContain('missions:execute');
  });
});
