import { describe, expect, it } from 'vitest';
import {
  getIntegrationRecipe,
  listIntegrationRecipes,
  planIntegrationInstall,
  assertValidIntegrationRecipe,
  validateIntegrationRecipe,
} from './recipes';

describe('integration recipes', () => {
  it('ships a complete Hermes Agent recipe with dry-run install steps', () => {
    const hermes = getIntegrationRecipe('hermes-agent');

    expect(hermes.name).toBe('Hermes Agent');
    expect(hermes.category).toBe('agent-runtime');
    expect(hermes.supportedPlatforms).toContain('darwin');
    expect(hermes.providerRequirements).toContain('openrouter');
    expect(hermes.healthChecks.some((check) => check.command === 'hermes')).toBe(true);

    const plan = planIntegrationInstall('hermes-agent', 'darwin');

    expect(plan.mode).toBe('dry-run');
    expect(plan.recipeId).toBe('hermes-agent');
    expect(plan.steps.length).toBeGreaterThan(2);
    expect(plan.steps[0].kind).toBe('prerequisite');
    expect(plan.steps.some((step) => step.command.includes('hermes --version'))).toBe(true);
  });

  it('rejects incomplete recipes before they can be exposed to the UI', () => {
    const invalid = {
      id: 'broken',
      name: '',
      supportedPlatforms: [],
      install: { steps: [] },
      healthChecks: [],
    };

    const errors = validateIntegrationRecipe(invalid);

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/name/i),
      expect.stringMatching(/supported platform/i),
      expect.stringMatching(/install step/i),
    ]));
    expect(() => assertValidIntegrationRecipe(invalid)).toThrow(/name/i);
  });

  it('keeps all bundled recipes valid and sorted for predictable rendering', () => {
    const recipes = listIntegrationRecipes();
    const ids = recipes.map((recipe) => recipe.id);

    expect(ids).toEqual([...ids].sort());
    expect(ids).toEqual(expect.arrayContaining([
      'claude-code',
      'codex-cli',
      'gemini-cli',
      'hermes-agent',
      'openclaw',
    ]));

    for (const recipe of recipes) {
      expect(validateIntegrationRecipe(recipe)).toEqual([]);
    }
  });

  it('blocks install plans on unsupported platforms', () => {
    expect(() => planIntegrationInstall('hermes-agent', 'sunos')).toThrow(/unsupported/i);
  });
});
