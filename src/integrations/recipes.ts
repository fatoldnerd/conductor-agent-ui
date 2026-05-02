export type IntegrationCategory = 'agent-runtime' | 'model-provider' | 'developer-tool';
export type SupportedPlatform = 'darwin' | 'linux' | 'win32';
export type ProviderRequirement = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'local';

export type RecipeStepKind = 'prerequisite' | 'install' | 'configure' | 'verify' | 'manual';

export type IntegrationRecipeStep = {
  id: string;
  title: string;
  kind: RecipeStepKind;
  description: string;
  command: string;
  requiresApproval?: boolean;
};

export type IntegrationHealthCheck = {
  id: string;
  label: string;
  command: string;
  args: string[];
  expected: string;
};

export type IntegrationRecipe = {
  id: string;
  name: string;
  shortName: string;
  category: IntegrationCategory;
  description: string;
  supportedPlatforms: SupportedPlatform[];
  providerRequirements: ProviderRequirement[];
  docsUrl: string;
  riskNotes: string[];
  prerequisites: string[];
  install: {
    strategy: 'shell' | 'oauth' | 'manual';
    steps: IntegrationRecipeStep[];
  };
  update: IntegrationRecipeStep[];
  uninstall: IntegrationRecipeStep[];
  healthChecks: IntegrationHealthCheck[];
};

export type IntegrationInstallPlan = {
  mode: 'dry-run';
  recipeId: string;
  platform: string;
  steps: IntegrationRecipeStep[];
  warnings: string[];
};

const recipes: IntegrationRecipe[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    shortName: 'Claude',
    category: 'agent-runtime',
    description: 'Anthropic terminal-native coding agent for repo work, reviews, and autonomous edits.',
    supportedPlatforms: ['darwin', 'linux', 'win32'],
    providerRequirements: ['anthropic'],
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    riskNotes: ['Requires Anthropic account auth.', 'Can edit files and run commands once launched by the user.'],
    prerequisites: ['node', 'npm'],
    install: {
      strategy: 'shell',
      steps: [
        step('claude-prereq-node', 'Check Node.js', 'prerequisite', 'Confirm Node.js is installed.', 'node --version'),
        step('claude-install', 'Install Claude Code', 'install', 'Install the Claude Code CLI through npm.', 'npm install -g @anthropic-ai/claude-code', true),
        step('claude-auth', 'Authenticate Claude Code', 'configure', 'Launch Claude Code auth/status flow.', 'claude auth status --text || claude'),
        step('claude-verify', 'Verify Claude Code', 'verify', 'Confirm Claude Code responds with a version.', 'claude --version'),
      ],
    },
    update: [step('claude-update', 'Update Claude Code', 'install', 'Upgrade Claude Code package.', 'npm update -g @anthropic-ai/claude-code', true)],
    uninstall: [step('claude-uninstall', 'Uninstall Claude Code', 'install', 'Remove Claude Code package.', 'npm uninstall -g @anthropic-ai/claude-code', true)],
    healthChecks: [health('claude-version', 'Claude Code CLI', 'claude', ['--version'], 'version output')],
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    shortName: 'Codex',
    category: 'agent-runtime',
    description: 'OpenAI coding agent CLI for repo work, parallel implementation, and review tasks.',
    supportedPlatforms: ['darwin', 'linux', 'win32'],
    providerRequirements: ['openai'],
    docsUrl: 'https://github.com/openai/codex',
    riskNotes: ['Requires OpenAI auth or API configuration.', 'Install package name may vary as Codex evolves.'],
    prerequisites: ['node', 'npm'],
    install: {
      strategy: 'shell',
      steps: [
        step('codex-prereq-node', 'Check Node.js', 'prerequisite', 'Confirm Node.js is installed.', 'node --version'),
        step('codex-install', 'Install Codex CLI', 'install', 'Install the Codex CLI package.', 'npm install -g @openai/codex', true),
        step('codex-auth', 'Authenticate Codex', 'configure', 'Run Codex auth/status command.', 'codex auth status || codex'),
        step('codex-verify', 'Verify Codex', 'verify', 'Confirm Codex responds with a version.', 'codex --version'),
      ],
    },
    update: [step('codex-update', 'Update Codex CLI', 'install', 'Upgrade Codex CLI package.', 'npm update -g @openai/codex', true)],
    uninstall: [step('codex-uninstall', 'Uninstall Codex CLI', 'install', 'Remove Codex CLI package.', 'npm uninstall -g @openai/codex', true)],
    healthChecks: [health('codex-version', 'Codex CLI', 'codex', ['--version'], 'version output')],
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    shortName: 'Gemini',
    category: 'agent-runtime',
    description: 'Google Gemini command-line agent tooling for model-backed coding and research workflows.',
    supportedPlatforms: ['darwin', 'linux', 'win32'],
    providerRequirements: ['google'],
    docsUrl: 'https://github.com/google-gemini/gemini-cli',
    riskNotes: ['Requires Google/Gemini credentials.', 'Official package details should be verified before first public installer release.'],
    prerequisites: ['node', 'npm'],
    install: {
      strategy: 'shell',
      steps: [
        step('gemini-prereq-node', 'Check Node.js', 'prerequisite', 'Confirm Node.js is installed.', 'node --version'),
        step('gemini-install', 'Install Gemini CLI', 'install', 'Install Gemini CLI package.', 'npm install -g @google/gemini-cli', true),
        step('gemini-auth', 'Authenticate Gemini', 'configure', 'Run Gemini auth or first-run setup.', 'gemini auth || gemini'),
        step('gemini-verify', 'Verify Gemini', 'verify', 'Confirm Gemini responds with a version.', 'gemini --version'),
      ],
    },
    update: [step('gemini-update', 'Update Gemini CLI', 'install', 'Upgrade Gemini CLI package.', 'npm update -g @google/gemini-cli', true)],
    uninstall: [step('gemini-uninstall', 'Uninstall Gemini CLI', 'install', 'Remove Gemini CLI package.', 'npm uninstall -g @google/gemini-cli', true)],
    healthChecks: [health('gemini-version', 'Gemini CLI', 'gemini', ['--version'], 'version output')],
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    shortName: 'Hermes',
    category: 'agent-runtime',
    description: 'Provider-agnostic agent framework with skills, memory, gateway integrations, cron jobs, and dashboard support.',
    supportedPlatforms: ['darwin', 'linux'],
    providerRequirements: ['openrouter', 'openai', 'anthropic', 'google', 'local'],
    docsUrl: 'https://hermes-agent.nousresearch.com/docs',
    riskNotes: ['Installer can modify shell PATH and user-level configuration.', 'Dashboard/API should bind to localhost by default.'],
    prerequisites: ['curl', 'python3', 'git'],
    install: {
      strategy: 'shell',
      steps: [
        step('hermes-prereq-python', 'Check Python', 'prerequisite', 'Confirm Python 3 is available.', 'python3 --version'),
        step('hermes-prereq-git', 'Check Git', 'prerequisite', 'Confirm Git is available.', 'git --version'),
        step('hermes-install', 'Install Hermes Agent', 'install', 'Run the official Hermes installer.', 'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash', true),
        step('hermes-setup', 'Run setup wizard', 'configure', 'Launch Hermes setup for provider, model, and tool configuration.', 'hermes setup'),
        step('hermes-verify', 'Verify Hermes', 'verify', 'Confirm Hermes responds with a version.', 'hermes --version'),
        step('hermes-doctor', 'Run Hermes doctor', 'verify', 'Check Hermes configuration and dependencies.', 'hermes doctor'),
      ],
    },
    update: [step('hermes-update', 'Update Hermes', 'install', 'Use Hermes built-in updater.', 'hermes update', true)],
    uninstall: [step('hermes-uninstall', 'Uninstall Hermes', 'install', 'Use Hermes built-in uninstaller.', 'hermes uninstall', true)],
    healthChecks: [
      health('hermes-version', 'Hermes CLI', 'hermes', ['--version'], 'version output'),
      health('hermes-doctor', 'Hermes doctor', 'hermes', ['doctor'], 'doctor completes'),
    ],
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    shortName: 'OpenClaw',
    category: 'agent-runtime',
    description: 'Open-source agentic development environment and orchestration layer for coding agents.',
    supportedPlatforms: ['darwin', 'linux'],
    providerRequirements: ['openrouter', 'openai', 'anthropic', 'google', 'local'],
    docsUrl: 'https://github.com/outsourc-e/OpenClaw',
    riskNotes: ['Requires Node/pnpm setup.', 'Repository, package, and installer details should be verified against the active upstream before public release.'],
    prerequisites: ['git', 'node', 'pnpm'],
    install: {
      strategy: 'shell',
      steps: [
        step('openclaw-prereq-node', 'Check Node.js', 'prerequisite', 'Confirm Node.js is available.', 'node --version'),
        step('openclaw-prereq-pnpm', 'Check pnpm', 'prerequisite', 'Confirm pnpm is available.', 'pnpm --version'),
        step('openclaw-fetch', 'Fetch OpenClaw', 'install', 'Clone or update the OpenClaw repository.', 'git clone https://github.com/outsourc-e/OpenClaw.git ~/.openclaw/OpenClaw || git -C ~/.openclaw/OpenClaw pull --ff-only', true),
        step('openclaw-install', 'Install dependencies', 'install', 'Install OpenClaw dependencies.', 'pnpm --dir ~/.openclaw/OpenClaw install', true),
        step('openclaw-verify', 'Verify OpenClaw workspace', 'verify', 'Confirm the OpenClaw checkout exists.', 'test -d ~/.openclaw/OpenClaw && echo OpenClaw ready'),
      ],
    },
    update: [step('openclaw-update', 'Update OpenClaw', 'install', 'Pull latest OpenClaw repository changes.', 'git -C ~/.openclaw/OpenClaw pull --ff-only && pnpm --dir ~/.openclaw/OpenClaw install', true)],
    uninstall: [step('openclaw-uninstall', 'Remove OpenClaw checkout', 'install', 'Remove local OpenClaw checkout.', 'rm -rf ~/.openclaw/OpenClaw', true)],
    healthChecks: [
      health('openclaw-node', 'Node.js', 'node', ['--version'], 'version output'),
      health('openclaw-pnpm', 'pnpm', 'pnpm', ['--version'], 'version output'),
    ],
  },
];

function step(
  id: string,
  title: string,
  kind: RecipeStepKind,
  description: string,
  command: string,
  requiresApproval = false,
): IntegrationRecipeStep {
  return { id, title, kind, description, command, requiresApproval };
}

function health(id: string, label: string, command: string, args: string[], expected: string): IntegrationHealthCheck {
  return { id, label, command, args, expected };
}

export function validateIntegrationRecipe(recipe: unknown): string[] {
  const errors: string[] = [];
  const r = recipe as Partial<IntegrationRecipe>;

  if (!r || typeof r !== 'object') return ['recipe must be an object'];
  if (!r.id || typeof r.id !== 'string') errors.push('id is required');
  if (!r.name || typeof r.name !== 'string') errors.push('name is required');
  if (!r.shortName || typeof r.shortName !== 'string') errors.push('shortName is required');
  if (!r.description || typeof r.description !== 'string') errors.push('description is required');
  if (!Array.isArray(r.supportedPlatforms) || r.supportedPlatforms.length === 0) errors.push('at least one supported platform is required');
  if (!Array.isArray(r.providerRequirements)) errors.push('providerRequirements must be an array');
  if (!r.install || !Array.isArray(r.install.steps) || r.install.steps.length === 0) errors.push('at least one install step is required');
  if (!Array.isArray(r.healthChecks) || r.healthChecks.length === 0) errors.push('at least one health check is required');

  return errors;
}

export function assertValidIntegrationRecipe(recipe: unknown): asserts recipe is IntegrationRecipe {
  const errors = validateIntegrationRecipe(recipe);
  if (errors.length) throw new Error(`Invalid integration recipe: ${errors.join(', ')}`);
}

export function listIntegrationRecipes(): IntegrationRecipe[] {
  const sorted = [...recipes].sort((a, b) => a.id.localeCompare(b.id));
  for (const recipe of sorted) assertValidIntegrationRecipe(recipe);
  return sorted;
}

export function getIntegrationRecipe(id: string): IntegrationRecipe {
  const recipe = listIntegrationRecipes().find((item) => item.id === id);
  if (!recipe) throw new Error(`Unknown integration recipe: ${id}`);
  return recipe;
}

function defaultRecipePlatform(): SupportedPlatform {
  if (typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')) return 'darwin';
  if (typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win')) return 'win32';
  return 'linux';
}

export function planIntegrationInstall(id: string, platform: string = defaultRecipePlatform()): IntegrationInstallPlan {
  const recipe = getIntegrationRecipe(id);
  if (!recipe.supportedPlatforms.includes(platform as SupportedPlatform)) {
    throw new Error(`${recipe.name} is unsupported on ${platform}`);
  }

  const warnings = [
    ...recipe.riskNotes,
    'Dry-run only: Conductor does not execute install commands until the user approves a future privileged action flow.',
  ];

  return {
    mode: 'dry-run',
    recipeId: recipe.id,
    platform,
    steps: recipe.install.steps,
    warnings,
  };
}
