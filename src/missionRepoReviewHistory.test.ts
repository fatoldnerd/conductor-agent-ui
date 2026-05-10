import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('Repo review mission history', () => {
  it('persists sanitized repo review metadata in renderer storage after completion', () => {
    expect(appSource).toContain('CONDUCTOR_REPO_REVIEW_HISTORY_KEY');
    expect(appSource).toContain('persistRepoReviewMissionHistory');
    expect(appSource).toContain('readRepoReviewMissionHistory');
    expect(appSource).toContain('repoName: missionResult.repoName');
    expect(appSource).toContain('deliverablePreview');
  });

  it('does not persist full project paths, prompts, commands, argv, or env in repo review history', () => {
    const persistBlock = appSource.slice(appSource.indexOf('function persistRepoReviewMissionHistory'), appSource.indexOf('function readRepoReviewMissionHistory'));
    expect(persistBlock).not.toContain('missionRepoPath');
    expect(persistBlock).not.toContain('projectPath');
    expect(persistBlock).not.toContain('prompt');
    expect(persistBlock).not.toContain('command');
    expect(persistBlock).not.toContain('args');
    expect(persistBlock).not.toContain('env');
  });

  it('surfaces persisted repo review missions in Activity without fake history', () => {
    expect(appSource).toContain('Repo review mission history');
    expect(appSource).toContain('No repo review missions have been recorded yet. Conductor will not show fake mission history.');
    expect(appSource).toContain('repoReviewHistory.map');
    expect(appSource).toContain('Repo review mission history is shown in its own section below.');
  });

  it('refreshes local repo review mission history from Activity, not only runtime audit history', () => {
    const loadBlock = appSource.slice(appSource.indexOf('const loadRuntimeActionHistory'), appSource.indexOf('const loadRuntimeActionApprovalQueue'));
    expect(loadBlock).toContain('setRepoReviewHistory(readRepoReviewMissionHistory())');
    expect(appSource).toContain('Refresh activity history');
    expect(appSource).toContain('Refresh also reloads local repo review mission history.');
  });
});
