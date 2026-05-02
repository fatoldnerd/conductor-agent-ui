import { describe, expect, it } from 'vitest';
import installerRunner from './installerRunner.cjs';

const {
  createInstallRun,
  getInstallRun,
  isAllowedInstallStep,
  listAuditEvents,
  runInstallStep,
} = installerRunner;

describe('privileged installer runner', () => {
  it('creates a Hermes install run with allowlisted steps only', () => {
    const run = createInstallRun('hermes-agent', 'linux', { approved: true, approvedBy: 'test' });

    expect(run.id).toMatch(/^run_/);
    expect(run.recipeId).toBe('hermes-agent');
    expect(run.status).toBe('ready');
    expect(run.steps.length).toBeGreaterThan(3);
    expect(run.steps.every((step) => isAllowedInstallStep('hermes-agent', step.id, step.command))).toBe(true);
  });

  it('refuses unknown or tampered commands before execution', async () => {
    const run = createInstallRun('hermes-agent', 'linux', { approved: true, approvedBy: 'test' });
    const first = run.steps[0];

    expect(isAllowedInstallStep('hermes-agent', first.id, 'rm -rf ~')).toBe(false);
    await expect(runInstallStep(run.id, first.id, { commandOverride: 'rm -rf ~' })).rejects.toThrow(/not allowlisted/i);
  });

  it('executes safe prerequisite checks and records audit events', async () => {
    const run = createInstallRun('hermes-agent', 'linux', { approved: true, approvedBy: 'test' });
    const result = await runInstallStep(run.id, 'hermes-prereq-python');
    const updated = getInstallRun(run.id);
    const audit = listAuditEvents(run.id);

    expect(result.status).toBe('succeeded');
    expect(result.exitCode).toBe(0);
    expect(updated.steps.find((step) => step.id === 'hermes-prereq-python').status).toBe('succeeded');
    expect(audit.map((event) => event.type)).toEqual(expect.arrayContaining(['run_created', 'step_started', 'step_finished']));
  });
});
