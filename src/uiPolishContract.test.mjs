import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

const cssSource = readFileSync(resolve('src/styles/index.css'), 'utf8');

describe('desktop UI polish contract', () => {
  it('keeps Agent Runtimes rows inside their cards on narrow desktop widths', () => {
    expect(cssSource).toContain('grid-template-columns: 10px minmax(0, 1fr);');
    expect(cssSource).toContain('.local-tool-row .chip');
    expect(cssSource).toContain('max-width: 100%;');
    expect(cssSource).toContain('.tool-row-actions {');
    expect(cssSource).toContain('grid-column: 2 / -1;');
  });

  it('removes the intrusive info-circle callouts from Agent Console and Installers', () => {
    expect(appSource).not.toContain('<IconInfo />');
    expect(appSource).not.toContain('agent-console-callout');
    expect(appSource).not.toContain('install-callout');
  });

  it('parks Agent Console behind an honest non-executable empty state until it is reliable', () => {
    expect(appSource).toContain('Agent Console is parked until the local run bridge is reliable');
    expect(appSource).not.toContain('window.conductor.agents.startRun');
    expect(appSource).not.toContain('Start run');
  });
});
