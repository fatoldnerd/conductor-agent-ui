import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('Mission Control repo review mission UI', () => {
  it('surfaces the first approved read-only repo review mission without generic execution copy', () => {
    expect(appSource).toContain('Start approved repo review');
    expect(appSource).toContain('Native approval required');
    expect(appSource).toContain('Fixed runtime: Codex CLI read-only');
    expect(appSource).toContain('startReadOnlyRepoReview');
    expect(appSource).toContain('missionReviewTranscript');
    expect(appSource).not.toContain('missions.execute');
    expect(appSource).not.toContain('missionCommand');
  });
});
