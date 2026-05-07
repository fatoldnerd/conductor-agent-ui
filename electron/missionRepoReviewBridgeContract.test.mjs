import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');
const preloadSource = readFileSync(resolve('electron/preload.cjs'), 'utf8');
const runnerSource = readFileSync(resolve('electron/missionRepoReviewRunner.cjs'), 'utf8');
const typesSource = readFileSync(resolve('src/electron.d.ts'), 'utf8');

describe('read-only repo review mission bridge contract', () => {
  it('exposes a narrow mission bridge without generic mission execution', () => {
    expect(mainSource).toContain("missions:startReadOnlyRepoReview");
    expect(mainSource).toContain('startApprovedRepoReviewMission');
    expect(preloadSource).toContain('startReadOnlyRepoReview: (projectPath)');
    expect(typesSource).toContain('startReadOnlyRepoReview: (projectPath: string)');

    for (const source of [mainSource, preloadSource, typesSource]) {
      expect(source).not.toContain('missions:execute');
      expect(source).not.toContain('startMission: (payload)');
      expect(source).not.toContain('missionCommand');
    }
  });

  it('keeps the runtime and prompt owned by Electron main, not the renderer', () => {
    expect(runnerSource).toContain("const FIXED_RUNTIME_ID = 'codex-cli'");
    expect(runnerSource).toContain('buildReadOnlyReviewPrompt');
    expect(runnerSource).toContain('Repo review mission accepts only projectPath');
    expect(runnerSource).toContain('showMessageBox');
    expect(runnerSource).toContain('codex exec --sandbox read-only --cd [project] [fixed review prompt]');
  });
});
