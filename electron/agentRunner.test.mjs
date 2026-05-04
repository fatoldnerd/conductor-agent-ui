import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  AgentRunController,
  buildRunSpec,
  listAgentRuntimes,
  validateProjectPath,
} from './agentRunner.cjs';

const dirStats = { isDirectory: () => true };
const fileStats = { isDirectory: () => false };

function statFor(existingDirs = ['/Users/brad/project']) {
  return (candidate) => {
    if (existingDirs.includes(candidate)) return dirStats;
    if (candidate === '/Users/brad/file.txt') return fileStats;
    throw Object.assign(new Error('missing'), { code: 'ENOENT' });
  };
}

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killedWith = null;
  child.kill = (signal) => {
    child.killedWith = signal;
    child.emit('close', null, signal);
    return true;
  };
  return child;
}

describe('agentRunner recipes', () => {
  it('lists only allowlisted agent runtime descriptors', () => {
    expect(listAgentRuntimes().map((runtime) => runtime.id)).toEqual(['claude-code', 'codex-cli', 'gemini-cli']);
  });

  it('rejects unknown runtimes and renderer-supplied command material', () => {
    const base = {
      runtimeId: 'claude-code',
      projectPath: '/Users/brad/project',
      prompt: 'Inspect this repo without writing.',
      mode: 'read-only',
    };

    expect(() => buildRunSpec({ ...base, runtimeId: 'unknown' }, { statSync: statFor() })).toThrow(/Unknown agent runtime/);
    expect(() => buildRunSpec({ ...base, command: 'rm' }, { statSync: statFor() })).toThrow(/Renderer cannot supply command/);
    expect(() => buildRunSpec({ ...base, args: ['--danger'] }, { statSync: statFor() })).toThrow(/Renderer cannot supply args/);
    expect(() => buildRunSpec({ ...base, env: { OPENAI_API_KEY: 'secret' } }, { statSync: statFor() })).toThrow(/Renderer cannot supply env/);
    expect(() => buildRunSpec({ ...base, shell: true }, { statSync: statFor() })).toThrow(/Renderer cannot supply shell/);
  });

  it('validates project directories before building command specs', () => {
    expect(validateProjectPath('/Users/brad/project', { statSync: statFor() })).toBe('/Users/brad/project');
    expect(() => validateProjectPath('relative/path', { statSync: statFor() })).toThrow(/absolute path/);
    expect(() => validateProjectPath('/', { statSync: statFor(['/']) })).toThrow(/filesystem root/);
    expect(() => validateProjectPath('/Users/brad/file.txt', { statSync: statFor() })).toThrow(/must be a directory/);
    expect(() => validateProjectPath('/Users/brad/missing', { statSync: statFor() })).toThrow(/does not exist/);
  });

  it('maps allowed runtimes to fixed command recipes without shell execution', () => {
    const claude = buildRunSpec({
      runtimeId: 'claude-code',
      projectPath: '/Users/brad/project',
      prompt: 'Summarize the repo.',
      mode: 'read-only',
    }, { statSync: statFor() });

    expect(claude).toMatchObject({ command: 'claude', cwd: '/Users/brad/project', mode: 'read-only' });
    expect(claude.args).toEqual(['-p', 'Summarize the repo.', '--permission-mode', 'plan']);

    const codex = buildRunSpec({
      runtimeId: 'codex-cli',
      projectPath: '/Users/brad/project',
      prompt: 'Review for bugs.',
      mode: 'read-only',
    }, { statSync: statFor() });

    expect(codex).toMatchObject({ command: 'codex', cwd: '/Users/brad/project', mode: 'read-only' });
    expect(codex.args).toEqual(['exec', '--sandbox', 'read-only', '--cd', '/Users/brad/project', 'Review for bugs.']);

    expect(() => buildRunSpec({
      runtimeId: 'gemini-cli',
      projectPath: '/Users/brad/project',
      prompt: 'Analyze this repo.',
      mode: 'read-only',
    }, { statSync: statFor() })).toThrow(/gated pending validation/);
  });
});

describe('AgentRunController lifecycle', () => {
  it('starts a run, emits streamed output, and records successful close', async () => {
    const child = fakeChild();
    const events = [];
    const controller = new AgentRunController({
      statSync: statFor(),
      randomId: () => 'abc123',
      now: () => new Date('2026-05-04T10:00:00.000Z'),
      spawn: (command, args, options) => {
        expect(command).toBe('claude');
        expect(args).toEqual(['-p', 'Summarize.', '--permission-mode', 'plan']);
        expect(options).toMatchObject({ cwd: '/Users/brad/project', shell: false, windowsHide: true });
        expect(options.env.OPENAI_API_KEY).toBeUndefined();
        return child;
      },
    });

    const { runId, snapshot, emitter } = controller.start({
      runtimeId: 'claude-code',
      projectPath: '/Users/brad/project',
      prompt: 'Summarize.',
      mode: 'read-only',
    });
    emitter.on('event', (event) => events.push(event));

    expect(runId).toMatch(/^agent_/);
    expect(snapshot).toMatchObject({ status: 'running', command: 'claude', cwd: '/Users/brad/project' });

    child.stdout.write('hello');
    child.stderr.write('warn');
    child.emit('close', 0, null);
    await new Promise((resolve) => setImmediate(resolve));

    expect(events).toContainEqual({ runId, type: 'stdout', chunk: 'hello' });
    expect(events).toContainEqual({ runId, type: 'stderr', chunk: 'warn' });
    expect(controller.get(runId)).toMatchObject({ status: 'succeeded', exitCode: 0 });
  });

  it('stops only known valid run ids', async () => {
    const child = fakeChild();
    const controller = new AgentRunController({
      statSync: statFor(),
      randomId: () => 'stop123',
      spawn: () => child,
    });

    expect(() => controller.stop('bad')).toThrow(/Invalid run id/);
    expect(() => controller.stop('agent_missing')).toThrow(/Unknown agent run/);

    const { runId } = controller.start({
      runtimeId: 'claude-code',
      projectPath: '/Users/brad/project',
      prompt: 'Summarize.',
      mode: 'read-only',
    });
    const snapshot = controller.stop(runId);
    expect(child.killedWith).toBe('SIGTERM');
    expect(snapshot.status).toBe('cancelling');
  });
});
