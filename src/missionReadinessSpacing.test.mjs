import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import appSource from './App.tsx?raw';

const cssSource = readFileSync(resolve(__dirname, 'styles/index.css'), 'utf8');

describe('Mission readiness spacing polish', () => {
  it('renders the read-only action safety hint as a separate block below the button', () => {
    expect(appSource).toContain('mission-readiness-actions');
    expect(appSource).toContain('mission-action-safety-hint');
    expect(appSource).toContain('Run read-only readiness check');
  });

  it('styles the action row and safety hint so they cannot visually concatenate', () => {
    expect(cssSource).toContain('.mission-readiness-actions');
    expect(cssSource).toContain('flex-direction: column');
    expect(cssSource).toContain('.mission-action-safety-hint');
    expect(cssSource).toContain('display: block');
  });

  it('keeps the readiness score as a separate badge in the result summary', () => {
    expect(appSource).toContain('className="mission-score"');
    expect(cssSource).toContain('.mission-score');
    expect(cssSource).toContain('border-radius: 999px');
  });
});
