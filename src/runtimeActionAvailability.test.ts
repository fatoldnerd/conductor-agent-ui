import { describe, expect, it } from 'vitest';
import {
  SAFE_ACTION_METADATA,
  describeRuntimeActionAvailability,
  safeAction,
  type RuntimeActionKind,
} from './runtimeReadiness';

const ALL_KINDS: RuntimeActionKind[] = [
  'refresh',
  'open_docs',
  'copy_install_command',
  'configure',
  'health_check',
  'preview_install',
  'coming_soon',
  'requires_desktop',
];

describe('describeRuntimeActionAvailability', () => {
  it('returns rendererCanExecute === false for every action kind in both modes', () => {
    for (const kind of ALL_KINDS) {
      const action = safeAction(kind);
      const desktop = describeRuntimeActionAvailability(action, { desktopAvailable: true });
      const browser = describeRuntimeActionAvailability(action, { desktopAvailable: false });
      expect(desktop.rendererCanExecute).toBe(false);
      expect(browser.rendererCanExecute).toBe(false);
    }
  });

  it('marks every desktop-required action as unavailable in browser mode', () => {
    for (const kind of ALL_KINDS) {
      const action = safeAction(kind);
      if (!action.requiresDesktop) continue;
      const browser = describeRuntimeActionAvailability(action, { desktopAvailable: false });
      expect(browser.mode).toBe('unavailable_in_browser');
      expect(browser.label).toBe('Unavailable in browser');
      expect(browser.reason).toMatch(/desktop/i);
      expect(browser.reason).not.toMatch(/runs|executes/i);
    }
  });

  it('classifies preview-only actions as preview_only in both modes when not desktop-gated', () => {
    for (const kind of ALL_KINDS) {
      const action = safeAction(kind);
      if (action.requiresDesktop || !action.previewOnly) continue;
      const desktop = describeRuntimeActionAvailability(action, { desktopAvailable: true });
      const browser = describeRuntimeActionAvailability(action, { desktopAvailable: false });
      expect(desktop.mode).toBe('preview_only');
      expect(browser.mode).toBe('preview_only');
      expect(desktop.label).toBe('Preview only');
      expect(desktop.reason).toMatch(/nothing is run/i);
    }
  });

  it('classifies refresh as a desktop action when the bridge is available', () => {
    const refresh = safeAction('refresh');
    const desktop = describeRuntimeActionAvailability(refresh, { desktopAvailable: true });
    expect(desktop.mode).toBe('requires_desktop');
    expect(desktop.label).toBe('Desktop action');
    expect(desktop.reason).toMatch(/Electron desktop bridge/i);
  });

  it('classifies open_docs as browser-safe', () => {
    const openDocs = safeAction('open_docs');
    const desktop = describeRuntimeActionAvailability(openDocs, { desktopAvailable: true });
    const browser = describeRuntimeActionAvailability(openDocs, { desktopAvailable: false });
    expect(desktop.mode).toBe('browser_safe');
    expect(browser.mode).toBe('browser_safe');
    expect(desktop.label).toBe('Browser-safe action');
    expect(desktop.reason).toMatch(/no local runtime state/i);
  });

  it('preserves preflight requirements and approval flag from the source action', () => {
    for (const kind of ALL_KINDS) {
      const action = safeAction(kind);
      const availability = describeRuntimeActionAvailability(action, { desktopAvailable: true });
      expect(availability.requirements).toEqual(action.preflight.requirements);
      expect(availability.requiresApproval).toBe(action.preflight.requiresApproval);
    }
  });

  it('never produces output that implies the renderer can run shell commands', () => {
    for (const kind of ALL_KINDS) {
      const action = safeAction(kind);
      for (const desktopAvailable of [true, false]) {
        const result = describeRuntimeActionAvailability(action, { desktopAvailable });
        const haystack = `${result.label} ${result.reason}`.toLowerCase();
        expect(haystack).not.toMatch(/runs a shell|runs commands|spawns a shell|exec a command/);
        expect(SAFE_ACTION_METADATA[kind].executesCommand).toBe(false);
      }
    }
  });
});
