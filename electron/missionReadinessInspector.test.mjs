import { describe, expect, it } from 'vitest';
import { inspectRepoReadinessMission } from './missionReadinessInspector.cjs';

function fakeFs(files = {}) {
  return {
    existsSync(target) {
      return Boolean(files[target]);
    },
    statSync(target) {
      if (!files[target]) throw new Error(`missing ${target}`);
      return { isDirectory: () => files[target] === 'dir' };
    },
    readFileSync(target) {
      if (typeof files[target] !== 'string') throw new Error(`missing file ${target}`);
      return files[target];
    },
  };
}

describe('read-only repo readiness mission inspector', () => {
  it('summarizes a local repo using only allowlisted metadata reads', () => {
    const auditEvents = [];
    const result = inspectRepoReadinessMission({ projectPath: '/tmp/example-app' }, {
      fs: fakeFs({
        '/tmp/example-app': 'dir',
        '/tmp/example-app/.git': 'dir',
        '/tmp/example-app/package.json': JSON.stringify({ scripts: { test: 'vitest run', build: 'vite build' } }),
        '/tmp/example-app/README.md': '# Example app',
      }),
      appendAuditEvents: (events) => auditEvents.push(...events),
      now: () => '2026-05-07T12:30:00.000Z',
      randomId: () => 'abc123',
    });

    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'succeeded',
      desktopApi: 'mission.inspectRepoReadiness',
      missionType: 'repo_readiness_inspection',
      repoName: 'example-app',
      rendererCanExecuteArbitraryActions: false,
      executedShell: false,
      commandAllowlist: [],
      summary: {
        hasGitRepository: true,
        packageManager: 'npm',
        hasTestScript: true,
        hasBuildScript: true,
        hasReadme: true,
      },
    });
    expect(result.projectPathLabel).toBe('example-app');
    expect(JSON.stringify(result)).not.toContain('/tmp/example-app');
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      desktopApi: 'mission.inspectRepoReadiness',
      actionKind: 'mission_repo_readiness_inspection',
      safeForLog: true,
      payloadSummary: 'repoName=example-app',
    });
  });

  it('rejects renderer command payloads and never exposes command execution', () => {
    expect(() => inspectRepoReadinessMission({
      projectPath: '/tmp/example-app',
      command: 'rm -rf /',
      args: ['--danger'],
    }, {
      fs: fakeFs({ '/tmp/example-app': 'dir' }),
      appendAuditEvents: () => {},
    })).toThrow('Mission inspector accepts only a projectPath');
  });
});
