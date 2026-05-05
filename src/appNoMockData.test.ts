import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('production operational UI data sources', () => {
  it('does not import mock operational data into App.tsx', () => {
    expect(appSource).not.toContain('./data/mockData');
  });

  it('does not render known runtime rows in browser Agent Runtimes mode', () => {
    expect(appSource).not.toContain('AgentRuntimeBrowserPreview');
  });

  it('renders runtime cards from canonical card metadata fields', () => {
    expect(appSource).toContain('tool.categoryLabel');
    expect(appSource).toContain('tool.diagnosis');
    expect(appSource).toContain('tool.primaryAction');
    expect(appSource).toContain('RuntimeDetailPanel');
    expect(appSource).toContain('tool.detailPanel');
    expect(appSource).toContain('action.previewOnly');
    expect(appSource).toContain('Suggested preview');
    expect(appSource).toContain('ActionPreflightDetails');
    expect(appSource).toContain('action.preflight.expectedEffect');
    expect(appSource).toContain('action.approval.userFacingSummary');
    expect(appSource).toContain('action.approval.mode');
    expect(appSource).toContain('No command will run without explicit approval');
    expect(appSource).toContain('readinessLabel(tool.readiness)');
  });
});
