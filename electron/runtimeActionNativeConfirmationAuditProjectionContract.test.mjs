import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(resolve('electron/main.cjs'), 'utf8');
const dialogSource = readFileSync(resolve('electron/runtimeActionNativeConfirmationDialog.cjs'), 'utf8');
const projectionSource = readFileSync(resolve('electron/runtimeActionNativeConfirmationAuditProjection.cjs'), 'utf8');

describe('native confirmation audit projection contract', () => {
  it('wires audit projection through Electron main storage without exposing execution channels', () => {
    expect(mainSource).toContain('runtime-action-audit.jsonl');
    expect(dialogSource).toContain('appendRuntimeActionAuditEvents');
    expect(dialogSource).toContain('buildRuntimeActionNativeConfirmationAuditEvent');
    expect(dialogSource).toContain('auditPath');
    expect(projectionSource).toContain('native_confirmation_confirmed');
    expect(projectionSource).toContain('native_confirmation_cancelled');
    expect(projectionSource).toContain('native_confirmation_invalid');
    expect(projectionSource).toContain('confirmed_no_execution');
    expect(projectionSource).toContain('cancelled_no_execution');
    expect(projectionSource).not.toMatch(/execFile|spawn|child_process|desktopApi:\s*confirmation\.execution\.desktopApi/);
    expect(mainSource).not.toContain("runtimeActions:execute");
    expect(mainSource).not.toContain("runtimeActions:runDesktopApi");
  });
});
