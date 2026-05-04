import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

describe('production operational UI data sources', () => {
  it('does not import mock operational data into App.tsx', () => {
    expect(appSource).not.toContain('./data/mockData');
  });

  it('does not render known runtime rows in browser Agent Runtimes mode', () => {
    expect(appSource).not.toContain('AgentRuntimeBrowserPreview');
  });
});
