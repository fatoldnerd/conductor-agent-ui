import { describe, expect, it } from 'vitest';
import {
  CANONICAL_RUNTIME_IDS,
  READINESS_METADATA,
  SAFE_ACTION_METADATA,
  readinessDiagnosis,
  readinessLabel,
  safeAction,
} from './runtimeReadiness';

describe('canonical runtime readiness model', () => {
  it('defines first-class runtime ids', () => {
    expect(CANONICAL_RUNTIME_IDS).toEqual([
      'claude-code',
      'codex-cli',
      'gemini-cli',
      'hermes',
      'openclaw',
    ]);
  });

  it('maps readiness states to truthful labels and diagnosis text', () => {
    const states = [
      'ready',
      'installed',
      'running',
      'missing',
      'needs_config',
      'needs_credentials',
      'broken',
      'unsupported',
      'not_scanned',
      'stopped',
    ] as const;

    for (const state of states) {
      expect(readinessLabel(state).length).toBeGreaterThan(0);
      expect(readinessDiagnosis(state).length).toBeGreaterThan(12);
    }
  });

  it('keeps not scanned distinct from missing', () => {
    expect(READINESS_METADATA.not_scanned.label).toBe('Not scanned');
    expect(READINESS_METADATA.not_scanned.diagnosis).toContain('No trusted desktop inventory scan');
    expect(READINESS_METADATA.missing.diagnosis).toContain('completed desktop inventory scan');
  });

  it('keeps config-needed and credential-needed diagnosis distinct', () => {
    expect(READINESS_METADATA.needs_config.diagnosis).toContain('configuration');
    expect(READINESS_METADATA.needs_credentials.diagnosis).toContain('credential markers');
  });

  it('defines safe action metadata without browser command execution', () => {
    for (const metadata of Object.values(SAFE_ACTION_METADATA)) {
      expect(metadata.executesCommand).toBe(false);
      if (metadata.browserSafe) expect(metadata.description).not.toMatch(/run shell|execute shell/i);
    }

    expect(safeAction('copy_install_command')).toMatchObject({
      browserSafe: true,
      executesCommand: false,
      requiresDesktop: false,
    });
    expect(safeAction('refresh')).toMatchObject({
      browserSafe: false,
      executesCommand: false,
      requiresDesktop: true,
    });
  });
});
