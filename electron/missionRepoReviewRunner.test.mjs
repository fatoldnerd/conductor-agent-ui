import { describe, expect, it } from 'vitest';
import { startApprovedRepoReviewMission } from './missionRepoReviewRunner.cjs';

const dirStats = { isDirectory: () => true };

function statFor(existingDirs = ['/Users/brad/project']) {
  return (candidate) => {
    if (existingDirs.includes(candidate)) return dirStats;
    throw Object.assign(new Error('missing'), { code: 'ENOENT' });
  };
}

describe('approved repo review mission runner', () => {
  it('rejects renderer supplied command material and accepts only projectPath', async () => {
    await expect(startApprovedRepoReviewMission({
      projectPath: '/Users/brad/project',
      runtimeId: 'claude-code',
    }, {})).rejects.toThrow(/accepts only projectPath/);

    await expect(startApprovedRepoReviewMission({
      projectPath: '/Users/brad/project',
      command: 'rm',
    }, {})).rejects.toThrow(/accepts only projectPath/);
  });

  it('requires native approval before starting the fixed read-only Codex repo review recipe', async () => {
    const auditEvents = [];
    const shownDialogs = [];
    const result = await startApprovedRepoReviewMission({ projectPath: '/Users/brad/project' }, {
      statSync: statFor(),
      randomId: () => 'abc123',
      now: () => '2026-05-07T16:00:00.000Z',
      showMessageBox: async (_parent, options) => {
        shownDialogs.push(options);
        return { response: 1 };
      },
      appendAuditEvents: (events) => auditEvents.push(...events),
      startAgentRun: (payload) => {
        expect(payload.runtimeId).toBe('codex-cli');
        expect(payload.mode).toBe('read-only');
        expect(payload.projectPath).toBe('/Users/brad/project');
        expect(payload.prompt).toContain('Read-only repo review mission');
        expect(payload.prompt).toContain('Do not modify files');
        expect(payload.command).toBeUndefined();
        expect(payload.args).toBeUndefined();
        expect(payload.env).toBeUndefined();
        return { runId: 'agent_abc123', snapshot: { runId: 'agent_abc123', status: 'running', runtimeId: 'codex-cli' } };
      },
    });

    expect(shownDialogs).toHaveLength(1);
    expect(shownDialogs[0].message).toContain('Start read-only repo review mission?');
    expect(shownDialogs[0].detail).toContain('Runtime: Codex CLI');
    expect(result).toMatchObject({
      status: 'started',
      desktopApi: 'mission.startReadOnlyRepoReview',
      missionType: 'read_only_repo_review',
      runtimeId: 'codex-cli',
      runId: 'agent_abc123',
      rendererCanExecuteArbitraryActions: false,
      executedShell: false,
      nativeApproval: { required: true, shown: true, confirmed: true },
    });
    expect(auditEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKind: 'mission_read_only_repo_review', outcome: 'native_approval_confirmed' }),
      expect.objectContaining({ actionKind: 'mission_read_only_repo_review', outcome: 'started' }),
    ]));
  });

  it('does not start the agent when native approval is cancelled', async () => {
    let started = false;
    const result = await startApprovedRepoReviewMission({ projectPath: '/Users/brad/project' }, {
      statSync: statFor(),
      randomId: () => 'cancelled',
      now: () => '2026-05-07T16:00:00.000Z',
      showMessageBox: async () => ({ response: 0 }),
      appendAuditEvents: () => undefined,
      startAgentRun: () => {
        started = true;
      },
    });

    expect(started).toBe(false);
    expect(result.status).toBe('cancelled');
    expect(result.nativeApproval.confirmed).toBe(false);
  });
});
