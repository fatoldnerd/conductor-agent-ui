import { describe, expect, it } from 'vitest';
import type { LocalInventory } from './electron';
import { buildLocalToolCategories } from './localTools';
import { deriveInventoryViewState } from './inventoryViewState';

function inventoryWithTools(tools: LocalInventory['tools'], configs: LocalInventory['configs'] = {}): LocalInventory {
  return {
    collectedAt: '2026-05-04T08:00:00.000Z',
    desktopSmoke: { bridgeExpected: true, platformSupported: true, status: 'ready' },
    machine: {
      platform: 'darwin',
      arch: 'arm64',
      osRelease: 'test',
      hostname: 'workstation',
      homeDir: '/Users/user',
      desktopCapable: true,
    },
    tools,
    services: {},
    agents: {},
    configs,
  };
}

function tool(id: string, available: boolean, status: 'ready' | 'missing' = available ? 'ready' : 'missing') {
  return {
    id,
    label: id,
    command: id,
    category: 'agent-runtime',
    available,
    status,
    version: available ? `${id} 1.0.0` : null,
    error: available ? undefined : 'not found',
  };
}

function stateFor(params: {
  desktopAvailable?: boolean;
  loading?: boolean;
  error?: string | null;
  inventory?: LocalInventory | null;
}) {
  const inventory = params.inventory ?? null;
  return deriveInventoryViewState({
    desktopAvailable: params.desktopAvailable ?? true,
    loading: params.loading ?? false,
    error: params.error ?? null,
    inventory,
    categories: buildLocalToolCategories(inventory),
  });
}

describe('inventory view states', () => {
  it('explains desktop bridge unavailable without implying a local scan ran', () => {
    const state = stateFor({ desktopAvailable: false });

    expect(state.kind).toBe('bridge_unavailable');
    expect(state.primaryAction).toBe('Requires desktop bridge');
    expect(state.hint).toContain('No local runtime scan');
  });

  it('explains loading while inventory is being scanned', () => {
    const state = stateFor({ loading: true });

    expect(state.kind).toBe('loading');
    expect(state.primaryAction).toBe('Scanning...');
    expect(state.body).toContain('No results are shown until the scan returns');
  });

  it('surfaces inventory scan errors with a retry action', () => {
    const state = stateFor({ error: 'bridge timeout' });

    expect(state.kind).toBe('error');
    expect(state.canRetry).toBe(true);
    expect(state.body).toContain('bridge timeout');
  });

  it('distinguishes not scanned from no tools detected', () => {
    const notScanned = stateFor({});
    const noTools = stateFor({
      inventory: inventoryWithTools({
        codex: tool('codex', false),
        claude: tool('claude', false),
      }),
    });

    expect(notScanned.kind).toBe('not_scanned');
    expect(notScanned.hint).toContain('Nothing has been marked missing');
    expect(noTools.kind).toBe('no_tools_detected');
    expect(noTools.hint).toContain('missing/stopped');
  });

  it('prioritizes config-needed state over partial missing state', () => {
    const state = stateFor({
      inventory: inventoryWithTools(
        {
          hermes: { ...tool('hermes', true), recipeId: 'hermes-agent' },
          codex: tool('codex', false),
        },
        {
          hermesConfig: {
            id: 'hermesConfig',
            path: '/Users/user/.hermes/config.yaml',
            exists: false,
            status: 'missing',
          },
        },
      ),
    });

    expect(state.kind).toBe('needs_config');
    expect(state.hint).toContain('need config');
  });
});
