import { describe, expect, it } from 'vitest';
import { collectLocalInventory } from './systemInventory.cjs';

const ok = (stdout) => ({ stdout, stderr: '' });
const missing = Object.assign(new Error('not found'), { code: 'ENOENT' });

function createFakeDeps() {
  const files = new Set(['/home/brad/.hermes/config.yaml', '/home/brad/.hermes/.env']);
  const commands = {
    'git --version': ok('git version 2.45.0\n'),
    'node --version': ok('v22.1.0\n'),
    'npm --version': ok('10.9.4\n'),
    'pnpm --version': ok('10.33.2\n'),
    'python3 --version': ok('Python 3.12.2\n'),
    'curl --version': ok('curl 8.7.1\n'),
    'hermes --version': ok('Hermes Agent v0.12.0\nProject: /home/brad/.hermes/hermes-agent\n'),
    'openclaw --version': missing,
    'claude --version': missing,
    'codex --version': ok('codex-cli 1.2.3\n'),
    'gemini --version': missing,
    'tmux -V': ok('tmux 3.4\n'),
    'vercel --version': ok('Vercel CLI 53.1.0\n'),
    'netlify --version': missing,
    'ss -ltnp': ok('LISTEN 0 4096 127.0.0.1:9119 0.0.0.0:* users:(("hermes",pid=11,fd=8))\nLISTEN 0 4096 127.0.0.1:8642 0.0.0.0:* users:(("hermes",pid=12,fd=8))\n'),
    'ps -eo pid,comm,args': ok('   11 hermes /venv/bin/python -m hermes_cli.main gateway run --replace\n   12 hermes /venv/bin/python /root/.local/bin/hermes api-server\n   42 node /Users/brad/.openclaw/runtime gateway\n'),
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
      if (!result && command.startsWith('/')) throw missing;
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
    expect(inventory.tools.gemini).toMatchObject({ available: false, label: 'Gemini CLI', recipeId: 'gemini-cli' });
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

  it('detects a local OpenClaw runtime on macOS without hardcoded personal agent names', async () => {
    const files = new Set(['/Users/brad/.openclaw/config.yaml']);
    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      'node --version': ok('v22.1.0\n'),
      'npm --version': ok('10.9.4\n'),
      'pnpm --version': ok('10.33.2\n'),
      'python3 --version': ok('Python 3.12.2\n'),
      'curl --version': ok('curl 8.7.1\n'),
      'tmux -V': ok('tmux 3.4\n'),
      'hermes --version': missing,
      'openclaw --version': ok('OpenClaw 2026.4.10\n'),
      'claude --version': ok('2.1.126 (Claude Code)\n'),
      'codex --version': ok('codex-cli 0.128.0\n'),
      'gemini --version': ok('0.1.12\n'),
      'vercel --version': missing,
      'netlify --version': missing,
      'ss -ltnp': Object.assign(new Error('ss missing on macOS'), { code: 'ENOENT' }),
      'lsof -nP -iTCP -sTCP:LISTEN': ok('node 100 brad 21u IPv4 TCP 127.0.0.1:3000 (LISTEN)\n'),
      'ps -eo pid,comm,args': ok('100 node /Users/brad/.openclaw/runtime gateway --port 3000\n'),
    };

    const inventory = await collectLocalInventory({
      homedir: () => '/Users/brad',
      platform: 'darwin',
      arch: 'arm64',
      hostname: () => 'brads-mac-mini',
      release: () => '24.6.0',
      async execFile(command, args = []) {
        const key = [command, ...args].join(' ');
        const result = commands[key];
        if (result instanceof Error) throw result;
        if (!result && command.startsWith('/')) throw missing;
        if (!result) throw new Error(`unexpected command ${key}`);
        return result;
      },
      async access(filePath) {
        if (!files.has(filePath)) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      },
      async readFile() {
        return 'agents: []\n';
      },
    });

    expect(inventory.machine.desktopCapable).toBe(true);
    expect(inventory.configs.openclawConfig).toMatchObject({ exists: true, path: '/Users/brad/.openclaw/config.yaml' });
    expect(inventory.services.openclaw).toMatchObject({ running: true });
    expect(inventory.agents).toEqual({});
    expect(inventory.desktopSmoke).toMatchObject({ bridgeExpected: true, platformSupported: true, status: 'ready' });
  });

  it('detects Codex CLI in npm-global bin and Claude Code in nvm node bin when Electron PATH is sparse', async () => {
    const home = '/Users/brad';
    const nvmRoot = `${home}/.nvm/versions/node`;
    const claudePath = `${nvmRoot}/v22.1.0/bin/claude`;
    const codexPath = `${home}/.npm-global/bin/codex`;

    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      '/usr/bin/node --version': ok('v22.1.0\n'),
      '/usr/bin/npm --version': ok('10.9.4\n'),
      '/usr/bin/python3 --version': ok('Python 3.12.2\n'),
      '/usr/bin/curl --version': ok('curl 8.7.1\n'),
      '/opt/homebrew/bin/gemini --version': ok('0.1.12\n'),
      [`${claudePath} --version`]: ok('2.1.126 (Claude Code)\n'),
      [`${codexPath} --version`]: ok('codex-cli 0.128.0\n'),
      'ss -ltnp': missing,
      'lsof -nP -iTCP -sTCP:LISTEN': ok(''),
      'ps -eo pid,comm,args': ok(''),
    };

    const inventory = await collectLocalInventory({
      homedir: () => home,
      platform: 'darwin',
      arch: 'arm64',
      hostname: () => 'macbook',
      release: () => '24.6.0',
      env: { PATH: '/usr/bin:/bin' },
      async execFile(command, args = []) {
        const key = [command, ...args].join(' ');
        const result = commands[key];
        if (result instanceof Error) throw result;
        if (result) return result;
        throw missing;
      },
      async access() {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      },
      async readFile() {
        return '';
      },
      async readdir(dir) {
        if (dir === nvmRoot) return ['v22.1.0', 'v20.19.0'];
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      },
    });

    expect(inventory.tools.codex).toMatchObject({ available: true, version: 'codex-cli 0.128.0' });
    expect(inventory.tools.claude).toMatchObject({ available: true, version: '2.1.126 (Claude Code)' });
    expect(inventory.tools.gemini).toMatchObject({ available: true, version: '0.1.12' });
    expect(inventory.tools.node).toMatchObject({ available: true, version: 'v22.1.0' });
  });

  it('falls back to a login zsh to resolve Claude Code when no static dir contains it', async () => {
    const home = '/Users/brad';
    const resolvedClaude = `${home}/Library/pnpm/claude`;

    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      '/opt/homebrew/bin/node --version': ok('v22.1.0\n'),
      '/opt/homebrew/bin/npm --version': ok('10.9.4\n'),
      '/opt/homebrew/bin/python3 --version': ok('Python 3.12.2\n'),
      '/opt/homebrew/bin/curl --version': ok('curl 8.7.1\n'),
      '/opt/homebrew/bin/gemini --version': ok('0.1.12\n'),
      [`${resolvedClaude} --version`]: ok('2.1.126 (Claude Code)\n'),
      'ss -ltnp': missing,
      'lsof -nP -iTCP -sTCP:LISTEN': ok(''),
      'ps -eo pid,comm,args': ok(''),
    };

    const inventory = await collectLocalInventory({
      homedir: () => home,
      platform: 'darwin',
      arch: 'arm64',
      hostname: () => 'macbook',
      release: () => '24.6.0',
      env: { PATH: '/usr/bin:/bin' },
      async execFile(command, args = []) {
        if (command === '/bin/zsh' && args[0] === '-lc') {
          const script = String(args[1] || '');
          if (script.includes('command -v claude')) return ok(`${resolvedClaude}\n`);
          throw missing;
        }
        const key = [command, ...args].join(' ');
        const result = commands[key];
        if (result instanceof Error) throw result;
        if (result) return result;
        throw missing;
      },
      async access() {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      },
      async readFile() {
        return '';
      },
      async readdir() {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      },
    });

    expect(inventory.tools.claude).toMatchObject({ available: true, version: '2.1.126 (Claude Code)' });
    expect(inventory.tools.codex).toMatchObject({ available: false, status: 'missing' });
  });

  it('detects macOS CLIs from Homebrew-style fallback paths when Electron PATH is sparse', async () => {
    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      '/opt/homebrew/bin/node --version': ok('v22.2.0\n'),
      '/opt/homebrew/bin/npm --version': ok('10.9.4\n'),
      '/opt/homebrew/bin/claude --version': ok('2.1.126 (Claude Code)\n'),
      '/opt/homebrew/bin/codex --version': ok('codex-cli 0.128.0\n'),
      '/opt/homebrew/bin/gemini --version': ok('0.1.12\n'),
      'ss -ltnp': missing,
      'lsof -nP -iTCP -sTCP:LISTEN': ok(''),
      'ps -eo pid,comm,args': ok(''),
    };

    const inventory = await collectLocalInventory({
      homedir: () => '/Users/brad',
      platform: 'darwin',
      arch: 'arm64',
      hostname: () => 'macbook',
      release: () => '24.6.0',
      env: { PATH: '/usr/bin:/bin' },
      async execFile(command, args = []) {
        const key = [command, ...args].join(' ');
        const result = commands[key];
        if (result instanceof Error) throw result;
        if (result) return result;
        throw missing;
      },
      async access() {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      },
      async readFile() {
        return '';
      },
    });

    expect(inventory.tools.claude).toMatchObject({ available: true, version: '2.1.126 (Claude Code)' });
    expect(inventory.tools.codex).toMatchObject({ available: true, version: 'codex-cli 0.128.0' });
    expect(inventory.tools.gemini).toMatchObject({ available: true, version: '0.1.12' });
    expect(inventory.tools.node).toMatchObject({ available: true, version: 'v22.2.0' });
    expect(inventory.tools.npm).toMatchObject({ available: true, version: '10.9.4' });
  });
});
