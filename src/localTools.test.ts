import { describe, expect, it } from 'vitest';
import { buildLocalToolCategories, fallbackInventoryTool, localToolSummary } from './localTools';
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
    const codex = runtimes.find((item) => item.id === 'codex');

    expect(hermes).toMatchObject({ readiness: 'needs_config', recipeId: 'hermes-agent' });
    expect(codex).toMatchObject({ readiness: 'installed', recipeId: 'codex-cli' });
    expect(hermes?.actions.map((action) => action.kind)).toContain('preview_install');
    expect(hermes?.actions.map((action) => action.kind)).toContain('health_check');
  });

  it('summarizes browser fallback state without live inventory', () => {
    const categories = buildLocalToolCategories(null);
    const summary = localToolSummary(categories);

    expect(summary.missing).toBeGreaterThan(0);
    expect(summary.recipes).toBeGreaterThanOrEqual(5);
    expect(fallbackInventoryTool('gemini', 'agent-runtime')).toMatchObject({
      label: 'Gemini CLI',
      recipeId: 'gemini-cli',
      available: false,
    });
  });
});
