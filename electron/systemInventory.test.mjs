import { describe, expect, it } from 'vitest';
import { collectLocalInventory } from './systemInventory.cjs';

const ok = (stdout) => ({ stdout, stderr: '' });
const missing = Object.assign(new Error('not found'), { code: 'ENOENT' });

function createFakeDeps() {
  const files = new Set(['/home/brad/.hermes/config.yaml', '/home/brad/.hermes/.env']);
  const commands = {
    'git --version': ok('git version 2.45.0\n'),
    'node --version': ok('v22.1.0\n'),
    'hermes --version': ok('Hermes Agent v0.12.0\nProject: /home/brad/.hermes/hermes-agent\n'),
    'claude --version': missing,
    'codex --version': ok('codex-cli 1.2.3\n'),
    'tmux -V': ok('tmux 3.4\n'),
    'vercel --version': ok('Vercel CLI 53.1.0\n'),
    'netlify --version': missing,
    'ss -ltnp': ok('LISTEN 0 4096 127.0.0.1:9119 0.0.0.0:* users:(("hermes",pid=11,fd=8))\nLISTEN 0 4096 127.0.0.1:8642 0.0.0.0:* users:(("hermes",pid=12,fd=8))\n'),
    'ps -eo pid,comm,args': ok('   11 hermes /venv/bin/python -m hermes_cli.main gateway run --replace\n   12 hermes /venv/bin/python /root/.local/bin/hermes api-server\n   42 node /Users/brad/OpenClaw/hugo gateway\n'),
  };

  return {
    homedir: () => '/home/brad',
    platform: 'linux',
    arch: 'x64',
    hostname: () => 'test-machine',
    release: () => '6.8.0',
    async execFile(command, args = []) {
      const key = [command, ...args].join(' ');
      const result = commands[key];
      if (result instanceof Error) throw result;
      if (!result) throw new Error(`unexpected command ${key}`);
      return result;
    },
    async access(filePath) {
      if (!files.has(filePath)) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    },
    async readFile(filePath) {
      if (filePath.endsWith('.env')) return 'GITHUB_TOKEN=secret\nVERCEL_TOKEN=secret\nPLAIN_VALUE=visible\n';
      return 'plugins:\n  enabled:\n    - kanban\n';
    },
  };
}

describe('collectLocalInventory', () => {
  it('returns sanitized tool, service, config, and secret-presence diagnostics', async () => {
    const inventory = await collectLocalInventory(createFakeDeps());

    expect(inventory.machine).toMatchObject({
      platform: 'linux',
      arch: 'x64',
      hostname: 'test-machine',
      homeDir: '/home/brad',
    });

    expect(inventory.tools.hermes).toMatchObject({ available: true, status: 'ready' });
    expect(inventory.tools.claude).toMatchObject({ available: false, status: 'missing' });
    expect(inventory.tools.tmux.version).toBe('tmux 3.4');

    expect(inventory.services.hermesGateway).toMatchObject({ running: true, status: 'running' });
    expect(inventory.services.hermesDashboard).toMatchObject({ running: true, port: 9119 });
    expect(inventory.services.hermesApi).toMatchObject({ running: true, port: 8642 });
    expect(inventory.services.openclaw).toMatchObject({ running: true });

    expect(inventory.configs.hermesConfig).toMatchObject({ exists: true, path: '/home/brad/.hermes/config.yaml' });
    expect(inventory.configs.hermesEnv.secrets).toEqual({
      GITHUB_TOKEN: true,
      VERCEL_TOKEN: true,
    });
    expect(JSON.stringify(inventory)).not.toContain('=secret');
    expect(JSON.stringify(inventory)).not.toContain('PLAIN_VALUE');
    expect(JSON.stringify(inventory)).not.toContain('visible');
  });
});
