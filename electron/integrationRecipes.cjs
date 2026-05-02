const recipes = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    category: 'agent-runtime',
    description: 'Anthropic terminal-native coding agent for repo work, reviews, and autonomous edits.',
    riskNotes: ['Requires Anthropic account auth.', 'Can edit files and run commands once launched by the user.'],
    supportedPlatforms: ['darwin', 'linux', 'win32'],
    providerRequirements: ['anthropic'],
    prerequisites: ['node', 'npm'],
    install: { steps: [
      step('claude-prereq-node', 'Check Node.js', 'prerequisite', 'Confirm Node.js is installed.', 'node --version'),
      step('claude-install', 'Install Claude Code', 'install', 'Install the Claude Code CLI through npm.', 'npm install -g @anthropic-ai/claude-code', true),
      step('claude-auth', 'Authenticate Claude Code', 'configure', 'Launch Claude Code auth/status flow.', 'claude auth status --text || claude'),
      step('claude-verify', 'Verify Claude Code', 'verify', 'Confirm Claude Code responds with a version.', 'claude --version'),
    ]},
    healthChecks: [{ id: 'claude-version', label: 'Claude Code CLI', command: 'claude', args: ['--version'], expected: 'version output' }],
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    category: 'agent-runtime',
    description: 'OpenAI coding agent CLI for repo work, parallel implementation, and review tasks.',
    riskNotes: ['Requires OpenAI auth or API configuration.', 'Install package name may vary as Codex evolves.'],
    supportedPlatforms: ['darwin', 'linux', 'win32'],
    providerRequirements: ['openai'],
    prerequisites: ['node', 'npm'],
    install: { steps: [
      step('codex-prereq-node', 'Check Node.js', 'prerequisite', 'Confirm Node.js is installed.', 'node --version'),
      step('codex-install', 'Install Codex CLI', 'install', 'Install the Codex CLI package.', 'npm install -g @openai/codex', true),
      step('codex-auth', 'Authenticate Codex', 'configure', 'Run Codex auth/status command.', 'codex auth status || codex'),
      step('codex-verify', 'Verify Codex', 'verify', 'Confirm Codex responds with a version.', 'codex --version'),
    ]},
    healthChecks: [{ id: 'codex-version', label: 'Codex CLI', command: 'codex', args: ['--version'], expected: 'version output' }],
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    category: 'agent-runtime',
    description: 'Google Gemini command-line agent tooling for model-backed coding and research workflows.',
    riskNotes: ['Requires Google/Gemini credentials.', 'Official package details should be verified before first public installer release.'],
    supportedPlatforms: ['darwin', 'linux', 'win32'],
    providerRequirements: ['google'],
    prerequisites: ['node', 'npm'],
    install: { steps: [
      step('gemini-prereq-node', 'Check Node.js', 'prerequisite', 'Confirm Node.js is installed.', 'node --version'),
      step('gemini-install', 'Install Gemini CLI', 'install', 'Install Gemini CLI package.', 'npm install -g @google/gemini-cli', true),
      step('gemini-auth', 'Authenticate Gemini', 'configure', 'Run Gemini auth or first-run setup.', 'gemini auth || gemini'),
      step('gemini-verify', 'Verify Gemini', 'verify', 'Confirm Gemini responds with a version.', 'gemini --version'),
    ]},
    healthChecks: [{ id: 'gemini-version', label: 'Gemini CLI', command: 'gemini', args: ['--version'], expected: 'version output' }],
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    category: 'agent-runtime',
    description: 'Provider-agnostic agent framework with skills, memory, gateway integrations, cron jobs, and dashboard support.',
    riskNotes: ['Installer can modify shell PATH and user-level configuration.', 'Dashboard/API should bind to localhost by default.'],
    supportedPlatforms: ['darwin', 'linux'],
    providerRequirements: ['openrouter', 'openai', 'anthropic', 'google', 'local'],
    prerequisites: ['curl', 'python3', 'git'],
    install: { steps: [
      step('hermes-prereq-python', 'Check Python', 'prerequisite', 'Confirm Python 3 is available.', 'python3 --version'),
      step('hermes-prereq-git', 'Check Git', 'prerequisite', 'Confirm Git is available.', 'git --version'),
      step('hermes-install', 'Install Hermes Agent', 'install', 'Run the official Hermes installer.', 'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash', true),
      step('hermes-setup', 'Run setup wizard', 'configure', 'Launch Hermes setup for provider, model, and tool configuration.', 'hermes setup'),
      step('hermes-verify', 'Verify Hermes', 'verify', 'Confirm Hermes responds with a version.', 'hermes --version'),
      step('hermes-doctor', 'Run Hermes doctor', 'verify', 'Check Hermes configuration and dependencies.', 'hermes doctor'),
    ]},
    healthChecks: [{ id: 'hermes-version', label: 'Hermes CLI', command: 'hermes', args: ['--version'], expected: 'version output' }],
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    category: 'agent-runtime',
    description: 'Open-source agentic development environment and orchestration layer for coding agents.',
    riskNotes: ['Requires Node/pnpm setup.', 'Repository, package, and installer details should be verified against the active upstream before public release.'],
    supportedPlatforms: ['darwin', 'linux'],
    providerRequirements: ['openrouter', 'openai', 'anthropic', 'google', 'local'],
    prerequisites: ['git', 'node', 'pnpm'],
    install: { steps: [
      step('openclaw-prereq-node', 'Check Node.js', 'prerequisite', 'Confirm Node.js is available.', 'node --version'),
      step('openclaw-prereq-pnpm', 'Check pnpm', 'prerequisite', 'Confirm pnpm is available.', 'pnpm --version'),
      step('openclaw-fetch', 'Fetch OpenClaw', 'install', 'Clone or update the OpenClaw repository.', 'git clone https://github.com/outsourc-e/OpenClaw.git ~/.openclaw/OpenClaw || git -C ~/.openclaw/OpenClaw pull --ff-only', true),
      step('openclaw-install', 'Install dependencies', 'install', 'Install OpenClaw dependencies.', 'pnpm --dir ~/.openclaw/OpenClaw install', true),
      step('openclaw-verify', 'Verify OpenClaw workspace', 'verify', 'Confirm the OpenClaw checkout exists.', 'test -d ~/.openclaw/OpenClaw && echo OpenClaw ready'),
    ]},
    healthChecks: [{ id: 'openclaw-node', label: 'Node.js', command: 'node', args: ['--version'], expected: 'version output' }],
  },
];

function step(id, title, kind, description, command, requiresApproval = false) {
  return { id, title, kind, description, command, requiresApproval };
}

function listIntegrationRecipes() {
  return [...recipes].sort((a, b) => a.id.localeCompare(b.id));
}

function getIntegrationRecipe(id) {
  const recipe = listIntegrationRecipes().find((item) => item.id === id);
  if (!recipe) throw new Error(`Unknown integration recipe: ${id}`);
  return recipe;
}

function planIntegrationInstall(id, platform = process.platform) {
  const recipe = getIntegrationRecipe(id);
  if (!recipe.supportedPlatforms.includes(platform)) {
    throw new Error(`${recipe.name} is unsupported on ${platform}`);
  }
  return {
    mode: 'dry-run',
    recipeId: recipe.id,
    platform,
    steps: recipe.install.steps,
    warnings: [
      ...(recipe.riskNotes || []),
      'Dry-run only. Commands are not executed until an explicit privileged installer flow exists.',
    ],
  };
}

module.exports = { listIntegrationRecipes, getIntegrationRecipe, planIntegrationInstall };
