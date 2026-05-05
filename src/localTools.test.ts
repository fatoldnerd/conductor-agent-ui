import { describe, expect, it } from 'vitest';
import { buildLocalToolCategories, fallbackInventoryTool, isDetectedLocalToolItem, localToolSummary } from './localTools';
import type { LocalInventory } from './electron';

function tool(id: string, overrides: Partial<LocalInventory['tools'][string]> = {}): LocalInventory['tools'][string] {
  return {
    id,
    label: id,
    command: id,
    category: 'developer-prerequisite',
    available: false,
    status: 'missing',
    version: null,
    error: 'not found',
    ...overrides,
  };
}

const inventory: LocalInventory = {
  collectedAt: '2026-05-04T08:00:00.000Z',
  desktopSmoke: { bridgeExpected: true, platformSupported: true, status: 'ready' },
  machine: {
    platform: 'linux',
    arch: 'x64',
    osRelease: 'test',
    hostname: 'workstation',
    homeDir: '/home/user',
    desktopCapable: true,
  },
  tools: {
    hermes: tool('hermes', {
      label: 'Hermes Agent',
      command: 'hermes',
      category: 'agent-runtime',
      recipeId: 'hermes-agent',
      available: true,
      status: 'ready',
      version: 'Hermes 1.0.0',
    }),
    codex: tool('codex', {
      label: 'Codex CLI',
      command: 'codex',
      category: 'agent-runtime',
      recipeId: 'codex-cli',
      available: true,
      status: 'ready',
      version: 'codex 1.2.3',
    }),
    git: tool('git', { label: 'Git', available: true, status: 'ready', version: 'git version 2.45.0' }),
    vercel: tool('vercel', { label: 'Vercel CLI', category: 'deployment-tool', available: true, status: 'ready', version: 'vercel 39.0.0' }),
  },
  services: {
    hermesApi: { id: 'hermesApi', label: 'Hermes API server', running: true, status: 'running', port: 8642 },
    openclaw: { id: 'openclaw', label: 'OpenClaw runtime', running: false, status: 'stopped' },
  },
  agents: {},
  configs: {
    hermesConfig: { id: 'hermesConfig', path: '/home/user/.hermes/config.yaml', exists: false, status: 'missing' },
    hermesEnv: { id: 'hermesEnv', path: '/home/user/.hermes/.env', exists: true, status: 'found', secrets: { OPENAI_API_KEY: true } },
    openclawConfig: { id: 'openclawConfig', path: '/home/user/.openclaw/config.yaml', exists: false, status: 'missing' },
  },
};

describe('local tool inventory view model', () => {
  function runtimeItems(source: LocalInventory | null) {
    return buildLocalToolCategories(source).find((category) => category.id === 'agent-runtimes')?.items ?? [];
  }

  it('groups runtimes, prerequisites, deployment tools, and services', () => {
    const categories = buildLocalToolCategories(inventory);

    expect(categories.map((category) => category.id)).toEqual([
      'agent-runtimes',
      'developer-prerequisites',
      'deployment-tools',
      'running-services',
    ]);
    expect(categories.find((category) => category.id === 'deployment-tools')?.items.map((item) => item.id)).toEqual(['vercel', 'netlify']);
    expect(categories.find((category) => category.id === 'running-services')?.items.map((item) => item.id)).toEqual(['hermesApi', 'openclaw']);
  });

  it('marks installed runtimes with missing known config as needing attention', () => {
    const runtimes = buildLocalToolCategories(inventory).find((category) => category.id === 'agent-runtimes')?.items ?? [];
    const hermes = runtimes.find((item) => item.id === 'hermes');
    const codex = runtimes.find((item) => item.id === 'codex-cli');

    expect(hermes).toMatchObject({
      categoryLabel: 'Agent runtime',
      readiness: 'needs_config',
      recipeId: 'hermes-agent',
      supportHint: expect.stringContaining('Configuration file was not detected'),
      primaryAction: expect.objectContaining({ kind: 'configure', executesCommand: false }),
    });
    expect(codex).toMatchObject({
      categoryLabel: 'Agent runtime',
      readiness: 'ready',
      recipeId: 'codex-cli',
      version: 'codex 1.2.3',
      diagnosis: expect.stringContaining('Detected locally'),
      primaryAction: expect.objectContaining({ kind: 'health_check', executesCommand: false }),
    });
    expect(hermes?.actions.map((action) => action.kind)).toContain('preview_install');
    expect(hermes?.actions.map((action) => action.kind)).toContain('health_check');
  });

  it('maps Electron inventory runtime ids to canonical ready runtime cards', () => {
    const electronInventory: LocalInventory = {
      ...inventory,
      tools: {
        claude: tool('claude', {
          label: 'Claude Code',
          command: 'claude',
          category: 'agent-runtime',
          recipeId: 'claude-code',
          available: true,
          status: 'ready',
          version: '2.1.126 (Claude Code)',
        }),
        codex: tool('codex', {
          label: 'Codex CLI',
          command: 'codex',
          category: 'agent-runtime',
          recipeId: 'codex-cli',
          available: true,
          status: 'ready',
          version: 'codex-cli 0.125.0',
        }),
        gemini: tool('gemini', {
          label: 'Gemini CLI',
          command: 'gemini',
          category: 'agent-runtime',
          recipeId: 'gemini-cli',
          available: true,
          status: 'ready',
          version: '0.1.7',
        }),
      },
      configs: {},
      services: {},
    };
    const categories = buildLocalToolCategories(electronInventory);
    const runtimes = categories.find((category) => category.id === 'agent-runtimes')?.items ?? [];
    const detectedRuntimeIds = runtimes.filter(isDetectedLocalToolItem).map((item) => item.id);

    expect(runtimes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'claude-code', label: 'Claude Code', readiness: 'ready', version: '2.1.126 (Claude Code)' }),
      expect.objectContaining({ id: 'codex-cli', label: 'Codex CLI', readiness: 'ready', version: 'codex-cli 0.125.0' }),
      expect.objectContaining({ id: 'gemini-cli', label: 'Gemini CLI', readiness: 'ready', version: '0.1.7' }),
    ]));
    expect(detectedRuntimeIds).toEqual(expect.arrayContaining(['claude-code', 'codex-cli', 'gemini-cli']));
    expect(localToolSummary(categories).installed).toBe(3);
  });

  it('distinguishes config-needed from credential-needed runtime state', () => {
    const configuredInventory: LocalInventory = {
      ...inventory,
      configs: {
        ...inventory.configs,
        hermesConfig: { id: 'hermesConfig', path: '/home/user/.hermes/config.yaml', exists: true, status: 'found' },
        hermesEnv: { id: 'hermesEnv', path: '/home/user/.hermes/.env', exists: true, status: 'found', secrets: {} },
      },
    };
    const runtimes = runtimeItems(configuredInventory);

    expect(runtimes.find((item) => item.id === 'hermes')).toMatchObject({
      readiness: 'needs_credentials',
      diagnosis: expect.stringContaining('credential markers'),
      supportHint: expect.stringContaining('Credential markers were not detected'),
      primaryAction: expect.objectContaining({ kind: 'configure', executesCommand: false }),
    });
  });

  it('builds runtime-specific detail panels for all canonical runtimes from sanitized inventory', () => {
    const runtimeInventory: LocalInventory = {
      ...inventory,
      tools: {
        claude: tool('claude', {
          label: 'Claude Code',
          command: 'claude',
          category: 'agent-runtime',
          recipeId: 'claude-code',
          available: true,
          status: 'ready',
          version: '2.1.126 (Claude Code)',
        }),
        codex: tool('codex', {
          label: 'Codex CLI',
          command: 'codex',
          category: 'agent-runtime',
          recipeId: 'codex-cli',
          available: true,
          status: 'ready',
          version: 'codex-cli 0.125.0',
        }),
        gemini: tool('gemini', {
          label: 'Gemini CLI',
          command: 'gemini',
          category: 'agent-runtime',
          recipeId: 'gemini-cli',
          available: true,
          status: 'ready',
          version: '0.1.7',
        }),
        hermes: tool('hermes', {
          label: 'Hermes Agent',
          command: 'hermes',
          category: 'agent-runtime',
          recipeId: 'hermes-agent',
          available: true,
          status: 'ready',
          version: 'Hermes 1.0.0',
        }),
        openclaw: tool('openclaw', {
          label: 'OpenClaw',
          command: 'openclaw',
          category: 'agent-runtime',
          recipeId: 'openclaw',
          available: true,
          status: 'ready',
          version: null,
        }),
      },
      configs: {
        hermesConfig: { id: 'hermesConfig', path: '/home/user/.hermes/config.yaml', exists: true, status: 'found' },
        hermesEnv: { id: 'hermesEnv', path: '/home/user/.hermes/.env', exists: true, status: 'found', secrets: { OPENAI_API_KEY: true } },
        openclawConfig: { id: 'openclawConfig', path: '/home/user/.openclaw/config.yaml', exists: false, status: 'missing' },
      },
      services: {
        hermesGateway: { id: 'hermesGateway', label: 'Hermes gateway', running: true, status: 'running' },
        hermesDashboard: { id: 'hermesDashboard', label: 'Hermes dashboard', running: false, status: 'stopped', port: 9119 },
        hermesApi: {
          id: 'hermesApi',
          label: 'Hermes API server',
          running: false,
          status: 'port_in_use',
          port: 8642,
          portState: 'ssh_tunnel',
          detail: 'Port is in use by an SSH tunnel, not a confirmed local Hermes service.',
        },
        openclaw: { id: 'openclaw', label: 'OpenClaw runtime', running: false, status: 'stopped' },
      },
    };
    const runtimes = runtimeItems(runtimeInventory);

    expect(runtimes.map((item) => item.detailPanel?.title)).toEqual([
      'Claude Code runtime details',
      'Codex CLI runtime details',
      'Gemini CLI runtime details',
      'Hermes runtime details',
      'OpenClaw runtime details',
    ]);
    expect(runtimes.find((item) => item.id === 'claude-code')?.detailPanel?.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Version', value: '2.1.126 (Claude Code)' }),
      expect.objectContaining({ label: 'Next safe action', value: expect.stringContaining('preview only') }),
    ]));
    expect(runtimes.find((item) => item.id === 'hermes')?.detailPanel?.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Hermes gateway', value: 'Running process detected', tone: 'ok' }),
      expect.objectContaining({ label: 'Hermes API server', value: 'Port is in use by an SSH tunnel, not a confirmed local Hermes service.', tone: 'warn' }),
    ]));
    expect(runtimes.find((item) => item.id === 'openclaw')?.detailPanel?.summary).toContain('needs config');
  });

  it('keeps runtime next-step actions explicit about preview-only execution', () => {
    const runtimes = runtimeItems(inventory);
    const hermes = runtimes.find((item) => item.id === 'hermes');
    const codex = runtimes.find((item) => item.id === 'codex-cli');

    expect(hermes?.primaryAction).toMatchObject({
      kind: 'configure',
      previewOnly: true,
      executesCommand: false,
    });
    expect(codex?.primaryAction).toMatchObject({
      kind: 'health_check',
      previewOnly: true,
      executesCommand: false,
    });
    expect(codex?.detailPanel?.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Next safe action', value: 'Health check (preview only)' }),
      expect.objectContaining({ label: 'Preflight risk', value: 'low risk' }),
      expect.objectContaining({ label: 'Expected effect', value: expect.stringContaining('no live check is executed') }),
      expect.objectContaining({ label: 'Approval', value: expect.stringContaining('Runtime readiness is not blocked') }),
      expect.objectContaining({ label: 'Approval', value: expect.stringContaining('future Conductor-triggered action') }),
      expect.objectContaining({ label: 'Requirements', value: expect.stringContaining('trusted metadata') }),
    ]));
    expect(codex?.detailPanel?.nextSteps[0]).toContain('Preview only:');
    expect(codex?.actions.find((action) => action.kind === 'open_docs')).toMatchObject({
      previewOnly: false,
      executesCommand: false,
      preflight: expect.objectContaining({
        riskLevel: 'none',
        requiresApproval: false,
      }),
    });
  });

  it('keeps runtime detail states distinct without inventing local state', () => {
    const brokenInventory: LocalInventory = {
      ...inventory,
      tools: {
        claude: tool('claude', {
          label: 'Claude Code',
          command: 'claude',
          category: 'agent-runtime',
          recipeId: 'claude-code',
          available: false,
          status: 'ready',
          error: 'version check failed',
        }),
        codex: tool('codex', {
          label: 'Codex CLI',
          command: 'codex',
          category: 'agent-runtime',
          recipeId: 'codex-cli',
          available: false,
          status: 'missing',
          error: 'not found',
        }),
        hermes: tool('hermes', {
          label: 'Hermes Agent',
          command: 'hermes',
          category: 'agent-runtime',
          recipeId: 'hermes-agent',
          available: true,
          status: 'ready',
          version: 'Hermes 1.0.0',
        }),
      },
      configs: {
        hermesConfig: { id: 'hermesConfig', path: '/home/user/.hermes/config.yaml', exists: true, status: 'found' },
        hermesEnv: { id: 'hermesEnv', path: '/home/user/.hermes/.env', exists: true, status: 'found', secrets: {} },
      },
      services: {},
    };

    const brokenRuntimes = runtimeItems(brokenInventory);
    expect(brokenRuntimes.find((item) => item.id === 'claude-code')?.detailPanel).toMatchObject({
      summary: expect.stringContaining('broken'),
      nextSteps: [expect.stringContaining('sanitized error detail')],
    });
    expect(brokenRuntimes.find((item) => item.id === 'codex-cli')?.detailPanel).toMatchObject({
      summary: expect.stringContaining('missing'),
      nextSteps: [expect.stringContaining('Install Codex CLI')],
    });
    expect(brokenRuntimes.find((item) => item.id === 'gemini-cli')?.detailPanel).toMatchObject({
      summary: expect.stringContaining('not scanned'),
      nextSteps: [expect.stringContaining('Refresh inventory')],
    });
    expect(brokenRuntimes.find((item) => item.id === 'hermes')?.detailPanel).toMatchObject({
      summary: expect.stringContaining('needs credentials'),
      nextSteps: [expect.stringContaining('credentials')],
    });

    const unconfiguredHermes = runtimeItems(inventory).find((item) => item.id === 'hermes');
    expect(unconfiguredHermes?.detailPanel).toMatchObject({
      summary: expect.stringContaining('needs config'),
      nextSteps: [expect.stringContaining('configuration guidance')],
    });
  });

  it('represents unscanned fallback tools as not scanned rather than missing', () => {
    const categories = buildLocalToolCategories(null);
    const summary = localToolSummary(categories);
    const runtimes = categories.find((category) => category.id === 'agent-runtimes')?.items ?? [];
    const prerequisites = categories.find((category) => category.id === 'developer-prerequisites')?.items ?? [];

    expect(runtimes.every((item) => item.readiness === 'not_scanned')).toBe(true);
    expect(prerequisites.every((item) => item.readiness === 'not_scanned')).toBe(true);
    expect(summary.notScanned).toBeGreaterThan(0);
    expect(summary.missing).toBe(0);
    expect(summary.recipes).toBeGreaterThanOrEqual(5);
    expect(fallbackInventoryTool('gemini', 'agent-runtime')).toMatchObject({
      label: 'Gemini CLI',
      recipeId: 'gemini-cli',
      available: false,
      status: 'not_scanned',
      error: 'not scanned',
    });
    expect(runtimes.find((item) => item.id === 'gemini-cli')).toMatchObject({
      readiness: 'not_scanned',
      version: null,
      detail: 'Awaiting desktop inventory scan',
      primaryAction: expect.objectContaining({ kind: 'refresh', executesCommand: false, disabled: true }),
    });
  });

  it('renders broken prerequisite diagnostics as broken rather than missing', () => {
    const categories = buildLocalToolCategories({
      ...inventory,
      tools: {
        pnpm: tool('pnpm', {
          label: 'pnpm',
          command: 'pnpm',
          category: 'developer-prerequisite',
          available: false,
          status: 'broken',
          version: null,
          diagnosticKind: 'package_manager_shim',
          error: 'pnpm was found, but its version check failed in a package manager shim. Check Corepack or package-manager configuration, then refresh inventory.',
        }),
      },
      configs: {},
      services: {},
    });
    const pnpm = categories.find((category) => category.id === 'developer-prerequisites')?.items.find((item) => item.id === 'pnpm');

    expect(pnpm).toMatchObject({
      readiness: 'broken',
      diagnosis: expect.stringContaining('detected'),
      detail: 'pnpm was found, but its version check failed in a package manager shim. Check Corepack or package-manager configuration, then refresh inventory.',
    });
    expect(pnpm?.detail).not.toContain('/Users/');
    expect(pnpm?.detail).not.toContain('at ');
  });

  it('represents SSH tunnel or port-in-use services without calling them running', () => {
    const categories = buildLocalToolCategories({
      ...inventory,
      services: {
        hermesApi: {
          id: 'hermesApi',
          label: 'Hermes API server',
          running: false,
          status: 'port_in_use',
          port: 8642,
          portState: 'ssh_tunnel',
          detail: 'Port is in use by an SSH tunnel, not a confirmed local Hermes service.',
        },
      },
    });
    const services = categories.find((category) => category.id === 'running-services')?.items ?? [];

    expect(services[0]).toMatchObject({
      label: 'Hermes API server',
      categoryLabel: 'Local service',
      readiness: 'stopped',
      detail: 'Port is in use by an SSH tunnel, not a confirmed local Hermes service.',
      supportHint: expect.stringContaining('port is occupied'),
    });
  });
});
