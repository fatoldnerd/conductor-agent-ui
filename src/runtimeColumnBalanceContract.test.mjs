import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

const cssSource = readFileSync(resolve('src/styles/index.css'), 'utf8');

describe('Agent Runtimes column balance contract', () => {
  it('renders runtime categories into explicit balanced columns instead of one auto grid', () => {
    expect(appSource).toContain('buildBalancedLocalToolColumns(categories)');
    expect(appSource).toContain('local-tools-column');
    expect(cssSource).toContain('.local-tools-column');
    expect(cssSource).toContain('display: flex;');
    expect(cssSource).toContain('align-self: start;');
  });

  it('keeps the tall Agent Runtimes panel paired with smaller panels in the opposite column', () => {
    expect(appSource).toContain("category.id === 'agent-runtimes'");
    expect(appSource).toContain("category.id === 'developer-prerequisites'");
    expect(appSource).toContain("category.id === 'deployment-tools'");
    expect(appSource).toContain("category.id === 'running-services'");
  });
});
