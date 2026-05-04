import { describe, expect, it } from 'vitest';
import { runtimeAvailable } from './agentRuntimeAvailability';
import type { AgentRuntimeDescriptor, LocalInventory } from './electron';

const runtime: AgentRuntimeDescriptor = {
  id: 'codex-cli',
  label: 'Codex CLI',
  command: 'codex',
  description: 'Codex runtime',
  supportedModes: ['read-only'],
  notes: [],
  needsValidation: false,
};

const inventory: LocalInventory = {
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
  tools: {
    codex: {
      id: 'codex',
      label: 'Codex CLI',
      command: 'codex',
      category: 'agent-runtime',
      recipeId: 'codex-cli',
      available: true,
      status: 'ready',
      version: 'codex 1.2.3',
    },
  },
  services: {},
  agents: {},
  configs: {},
};

describe('agent runtime availability', () => {
  it('does not treat unavailable inventory as runtime availability', () => {
    expect(runtimeAvailable(runtime, null)).toBe(false);
  });

  it('uses sanitized inventory tool availability when inventory is present', () => {
    expect(runtimeAvailable(runtime, inventory)).toBe(true);
    expect(runtimeAvailable(runtime, { ...inventory, tools: {} })).toBe(false);
  });

  it('keeps validation-gated runtimes unavailable even if inventory has the command', () => {
    expect(runtimeAvailable({ ...runtime, needsValidation: true }, inventory)).toBe(false);
  });
});
