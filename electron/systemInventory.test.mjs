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

  it('does not mark SSH-owned Hermes ports as running services', async () => {
    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      'node --version': ok('v22.1.0\n'),
      'npm --version': ok('10.9.4\n'),
      'pnpm --version': missing,
      'python3 --version': ok('Python 3.12.2\n'),
      'curl --version': ok('curl 8.7.1\n'),
      'tmux -V': missing,
      'hermes --version': missing,
      'openclaw --version': missing,
      'claude --version': missing,
      'codex --version': missing,
      'gemini --version': missing,
      'vercel --version': missing,
      'netlify --version': missing,
      'ss -ltnp': Object.assign(new Error('ss missing on macOS'), { code: 'ENOENT' }),
      'lsof -nP -iTCP -sTCP:LISTEN': ok(
        'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\n' +
        'ssh 700 user 12u IPv4 0x1 0t0 TCP 127.0.0.1:9119 (LISTEN)\n' +
        'ssh 700 user 13u IPv4 0x2 0t0 TCP 127.0.0.1:8642 (LISTEN)\n',
      ),
      'ps -eo pid,comm,args': ok('700 ssh -N -L [redacted]\n'),
    };

    const inventory = await collectLocalInventory({
      homedir: () => '/Users/user',
      platform: 'darwin',
      arch: 'arm64',
      hostname: () => 'mac',
      release: () => '24.6.0',
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

    expect(inventory.services.hermesDashboard).toMatchObject({
      running: false,
      status: 'port_in_use',
      port: 9119,
      portState: 'ssh_tunnel',
    });
    expect(inventory.services.hermesApi).toMatchObject({
      running: false,
      status: 'port_in_use',
      port: 8642,
      portState: 'ssh_tunnel',
    });
    expect(JSON.stringify(inventory.services)).not.toContain('-L');
  });

  it('marks Hermes ports running only when listener owner is Hermes-compatible', async () => {
    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      'node --version': ok('v22.1.0\n'),
      'npm --version': ok('10.9.4\n'),
      'pnpm --version': missing,
      'python3 --version': ok('Python 3.12.2\n'),
      'curl --version': ok('curl 8.7.1\n'),
      'tmux -V': missing,
      'hermes --version': ok('Hermes Agent v0.12.0\n'),
      'openclaw --version': missing,
      'claude --version': missing,
      'codex --version': missing,
      'gemini --version': missing,
      'vercel --version': missing,
      'netlify --version': missing,
      'ss -ltnp': Object.assign(new Error('ss missing on macOS'), { code: 'ENOENT' }),
      'lsof -nP -iTCP -sTCP:LISTEN': ok(
        'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\n' +
        'python 810 user 12u IPv4 0x1 0t0 TCP 127.0.0.1:9119 (LISTEN)\n' +
        'python 811 user 13u IPv4 0x2 0t0 TCP 127.0.0.1:8642 (LISTEN)\n',
      ),
      'ps -eo pid,comm,args': ok(
        '810 python -m hermes dashboard\n' +
        '811 python -m hermes api-server\n',
      ),
    };

    const inventory = await collectLocalInventory({
      homedir: () => '/Users/user',
      platform: 'darwin',
      arch: 'arm64',
      hostname: () => 'mac',
      release: () => '24.6.0',
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

    expect(inventory.services.hermesDashboard).toMatchObject({ running: true, status: 'running', port: 9119 });
    expect(inventory.services.hermesApi).toMatchObject({ running: true, status: 'running', port: 8642 });
  });

  it('represents non-Hermes listeners on Hermes ports as generic port-in-use', async () => {
    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      'node --version': ok('v22.1.0\n'),
      'npm --version': ok('10.9.4\n'),
      'pnpm --version': missing,
      'python3 --version': ok('Python 3.12.2\n'),
      'curl --version': ok('curl 8.7.1\n'),
      'tmux -V': missing,
      'hermes --version': missing,
      'openclaw --version': missing,
      'claude --version': missing,
      'codex --version': missing,
      'gemini --version': missing,
      'vercel --version': missing,
      'netlify --version': missing,
      'ss -ltnp': Object.assign(new Error('ss missing on macOS'), { code: 'ENOENT' }),
      'lsof -nP -iTCP -sTCP:LISTEN': ok('node 900 user 12u IPv4 0x1 0t0 TCP 127.0.0.1:8642 (LISTEN)\n'),
      'ps -eo pid,comm,args': ok('900 node local-dev-server.js\n'),
    };

    const inventory = await collectLocalInventory({
      homedir: () => '/Users/user',
      platform: 'darwin',
      arch: 'arm64',
      hostname: () => 'mac',
      release: () => '24.6.0',
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

    expect(inventory.services.hermesApi).toMatchObject({
      running: false,
      status: 'port_in_use',
      port: 8642,
      portState: 'other_process',
    });
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

  it('detects Codex CLI from pnpm global bin when Electron PATH and zsh fallback miss it', async () => {
    const home = '/Users/brad';
    const codexPath = `${home}/Library/pnpm/codex`;

    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      '/opt/homebrew/bin/node --version': ok('v22.1.0\n'),
      '/opt/homebrew/bin/npm --version': ok('10.9.4\n'),
      '/opt/homebrew/bin/python3 --version': ok('Python 3.12.2\n'),
      '/opt/homebrew/bin/curl --version': ok('curl 8.7.1\n'),
      '/opt/homebrew/bin/claude --version': ok('2.1.126 (Claude Code)\n'),
      '/opt/homebrew/bin/gemini --version': ok('0.1.12\n'),
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
        if (command === '/bin/zsh' && args[0] === '-lc') return ok('');
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

    expect(inventory.tools.codex).toMatchObject({ available: true, version: 'codex-cli 0.128.0' });
    expect(inventory.tools.claude).toMatchObject({ available: true, version: '2.1.126 (Claude Code)' });
    expect(inventory.tools.gemini).toMatchObject({ available: true, version: '0.1.12' });
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

  it('passes enriched PATH to Homebrew shims so Codex can find node from env shebangs', async () => {
    const seen = [];
    const inventory = await collectLocalInventory({
      homedir: () => '/Users/brad',
      platform: 'darwin',
      arch: 'arm64',
      hostname: () => 'macbook',
      release: () => '24.6.0',
      env: { PATH: '/usr/bin:/bin' },
      async execFile(command, args = [], options = {}) {
        seen.push({ command, args, path: options.env?.PATH });
        if (command === '/opt/homebrew/bin/codex') {
          if (!String(options.env?.PATH || '').split(':').includes('/opt/homebrew/bin')) {
            throw Object.assign(new Error('/usr/bin/env: node: No such file or directory'), { code: 127 });
          }
          return ok('codex-cli 0.128.0\n');
        }
        if (command === '/opt/homebrew/bin/node') return ok('v22.2.0\n');
        if (command === '/opt/homebrew/bin/npm') return ok('10.9.4\n');
        if (command === '/opt/homebrew/bin/claude') return ok('2.1.126 (Claude Code)\n');
        if (command === '/opt/homebrew/bin/gemini') return ok('0.1.12\n');
        if (command === '/usr/bin/python3') return ok('Python 3.12.2\n');
        if (command === '/usr/bin/curl') return ok('curl 8.7.1\n');
        if (command === 'git') return ok('git version 2.45.0\n');
        if (command === 'ss' || command === 'lsof' || command === 'ps') return ok('');
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

    expect(inventory.tools.codex).toMatchObject({ available: true, version: 'codex-cli 0.128.0' });
    expect(seen.find((call) => call.command === '/opt/homebrew/bin/codex')?.path).toContain('/opt/homebrew/bin');
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

  it('marks detected package-manager shims as broken with sanitized diagnostics when version checks crash', async () => {
    const home = '/Users/private-user';
    const pnpmError = Object.assign(new Error(
      'Command failed: /opt/homebrew/bin/pnpm --version\n' +
      'Error: Cannot find matching keyid\n' +
      '    at verifySignature (/opt/homebrew/Cellar/node/22.11.0/lib/node_modules/corepack/dist/lib/corepack.cjs:21535:47)\n' +
      '    at async Engine.executePackageManagerRequest (/Users/private-user/.local/share/corepack/corepack.cjs:22882:20)\n' +
      'TOKEN=secret ssh -N -L example.internal:8642:localhost:8642',
    ), {
      code: 1,
      stdout: '',
      stderr:
        'Error: Cannot find matching keyid\n' +
        '    at verifySignature (/opt/homebrew/Cellar/node/22.11.0/lib/node_modules/corepack/dist/lib/corepack.cjs:21535:47)\n' +
        '    at async Engine.executePackageManagerRequest (/Users/private-user/.local/share/corepack/corepack.cjs:22882:20)\n',
    });
    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      '/opt/homebrew/bin/node --version': ok('v22.2.0\n'),
      '/opt/homebrew/bin/npm --version': ok('10.9.4\n'),
      '/opt/homebrew/bin/pnpm --version': pnpmError,
      '/opt/homebrew/bin/python3 --version': ok('Python 3.12.2\n'),
      '/opt/homebrew/bin/curl --version': ok('curl 8.7.1\n'),
      '/opt/homebrew/bin/claude --version': ok('2.1.126 (Claude Code)\n'),
      '/opt/homebrew/bin/codex --version': ok('codex-cli 0.128.0\n'),
      '/opt/homebrew/bin/gemini --version': ok('0.1.12\n'),
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
    });

    expect(inventory.tools.pnpm).toMatchObject({
      available: false,
      status: 'broken',
      version: null,
      diagnosticKind: 'package_manager_shim',
      error: 'pnpm was found, but its version check failed in a package manager shim. Check Corepack or package-manager configuration, then refresh inventory.',
    });
    expect(inventory.tools.pnpm.error).not.toContain('/Users/private-user');
    expect(inventory.tools.pnpm.error).not.toContain('/opt/homebrew');
    expect(inventory.tools.pnpm.error).not.toContain('verifySignature');
    expect(inventory.tools.pnpm.error).not.toContain('TOKEN=secret');
    expect(inventory.tools.pnpm.error).not.toContain('-L');
    expect(inventory.tools.pnpm.error).not.toContain('example.internal');
  });

  it('classifies crashing CLI version checks as broken with a sanitized runtime_error summary', async () => {
    const home = '/Users/private-user';
    const codexCrash = Object.assign(new Error(
      'Command failed: /opt/homebrew/bin/codex --version\n' +
      'TypeError: Cannot read properties of undefined (reading \'parse\')\n' +
      '    at parseArgs (/opt/homebrew/Cellar/codex/0.1/lib/codex/cli.js:40:12)\n' +
      'TOKEN=secret ssh -N -L example.internal:8642:localhost:8642',
    ), {
      code: 1,
      stdout: '',
      stderr:
        'TypeError: Cannot read properties of undefined (reading \'parse\')\n' +
        '    at parseArgs (/opt/homebrew/Cellar/codex/0.1/lib/codex/cli.js:40:12)\n',
    });
    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      '/opt/homebrew/bin/node --version': ok('v22.2.0\n'),
      '/opt/homebrew/bin/npm --version': ok('10.9.4\n'),
      '/opt/homebrew/bin/pnpm --version': ok('10.33.2\n'),
      '/opt/homebrew/bin/python3 --version': ok('Python 3.12.2\n'),
      '/opt/homebrew/bin/curl --version': ok('curl 8.7.1\n'),
      '/opt/homebrew/bin/claude --version': ok('2.1.126 (Claude Code)\n'),
      '/opt/homebrew/bin/codex --version': codexCrash,
      '/opt/homebrew/bin/gemini --version': ok('0.1.12\n'),
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
    });

    expect(inventory.tools.codex).toMatchObject({
      available: false,
      status: 'broken',
      version: null,
      diagnosticKind: 'runtime_error',
    });
    expect(inventory.tools.codex.error).toContain('crashed');
    expect(inventory.tools.codex.error).not.toContain('TypeError');
    expect(inventory.tools.codex.error).not.toContain('parseArgs');
    expect(inventory.tools.codex.error).not.toContain('/opt/homebrew');
    expect(inventory.tools.codex.error).not.toContain('/Users/');
    expect(inventory.tools.codex.error).not.toContain('TOKEN=secret');
    expect(inventory.tools.codex.error).not.toContain('example.internal');
  });

  it('classifies permission failures as broken with a sanitized permission summary', async () => {
    const home = '/Users/private-user';
    const claudePermissionError = Object.assign(new Error(
      'Command failed: /opt/homebrew/bin/claude --version\n' +
      'EPERM: operation not permitted, open \'/Users/private-user/.config/claude/settings.json\'\n' +
      'TOKEN=secret',
    ), {
      code: 1,
      stdout: '',
      stderr:
        'EPERM: operation not permitted, open \'/Users/private-user/.config/claude/settings.json\'\n',
    });
    const commands = {
      'git --version': ok('git version 2.45.0\n'),
      '/opt/homebrew/bin/node --version': ok('v22.2.0\n'),
      '/opt/homebrew/bin/npm --version': ok('10.9.4\n'),
      '/opt/homebrew/bin/pnpm --version': ok('10.33.2\n'),
      '/opt/homebrew/bin/python3 --version': ok('Python 3.12.2\n'),
      '/opt/homebrew/bin/curl --version': ok('curl 8.7.1\n'),
      '/opt/homebrew/bin/claude --version': claudePermissionError,
      '/opt/homebrew/bin/codex --version': ok('codex-cli 0.128.0\n'),
      '/opt/homebrew/bin/gemini --version': ok('0.1.12\n'),
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
    });

    expect(inventory.tools.claude).toMatchObject({
      available: false,
      status: 'broken',
      version: null,
      diagnosticKind: 'permission',
    });
    expect(inventory.tools.claude.error).toContain('permissions');
    expect(inventory.tools.claude.error).not.toContain('/Users/private-user');
    expect(inventory.tools.claude.error).not.toContain('settings.json');
    expect(inventory.tools.claude.error).not.toContain('TOKEN=secret');
  });
});
