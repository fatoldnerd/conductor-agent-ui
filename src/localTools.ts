import type { InventoryConfigStatus, InventoryServiceStatus, InventoryToolStatus, LocalInventory } from './electron';
import { getIntegrationRecipe, listIntegrationRecipes, type IntegrationHealthCheck, type IntegrationRecipe } from './integrations/recipes';
import {
  CANONICAL_RUNTIME_IDS,
  RUNTIME_INVENTORY_KEYS,
  readinessDiagnosis,
  safeAction,
  type CanonicalRuntimeId,
  type RuntimeActionKind,
  type RuntimeActionMetadata,
  type RuntimeReadiness,
} from './runtimeReadiness';

export type LocalToolCategoryId = 'agent-runtimes' | 'developer-prerequisites' | 'deployment-tools' | 'running-services';
export type LocalToolReadiness = RuntimeReadiness;
export type LocalToolActionKind = RuntimeActionKind;

export type LocalToolAction = RuntimeActionMetadata & {
  recipeId?: string;
  docsUrl?: string;
  disabled?: boolean;
  title?: string;
};

export type LocalToolItem = {
  id: string;
  label: string;
  description: string;
  categoryId: LocalToolCategoryId;
  readiness: LocalToolReadiness;
  version: string | null;
  detail: string;
  diagnosis: string;
  recipeId?: string;
  recipe?: IntegrationRecipe;
  healthChecks: IntegrationHealthCheck[];
  config?: InventoryConfigStatus;
  service?: InventoryServiceStatus;
  actions: LocalToolAction[];
};

export type LocalToolCategory = {
  id: LocalToolCategoryId;
  title: string;
  subtitle: string;
  items: LocalToolItem[];
};

const RUNTIME_IDS = CANONICAL_RUNTIME_IDS;
const PREREQUISITE_IDS = ['git', 'node', 'npm', 'pnpm', 'python3', 'curl', 'tmux'];
const DEPLOYMENT_IDS = ['vercel', 'netlify'];
const TOOL_RECIPE_IDS: Record<string, string> = {
  openclaw: 'openclaw',
  hermes: 'hermes-agent',
  claude: 'claude-code',
  codex: 'codex-cli',
  gemini: 'gemini-cli',
};
const TOOL_LABELS: Record<string, string> = {
  git: 'Git',
  node: 'Node.js',
  npm: 'npm',
  pnpm: 'pnpm',
  python3: 'Python 3',
  curl: 'curl',
  tmux: 'tmux',
  vercel: 'Vercel CLI',
  netlify: 'Netlify CLI',
};
const TOOL_DESCRIPTIONS: Record<string, string> = {
  git: 'Source control required by runtime installers and workspace operations.',
  node: 'JavaScript runtime used by agent CLIs and local desktop tooling.',
  npm: 'Package manager used by several agent runtime installers.',
  pnpm: 'Package manager required by OpenClaw workspace setup.',
  python3: 'Python runtime required by Hermes and local automation tasks.',
  curl: 'Network fetch tool used by guided installer recipes.',
  tmux: 'Terminal multiplexer used by long-running local agent sessions.',
  vercel: 'Deployment CLI detected for hosted preview and release workflows.',
  netlify: 'Deployment CLI detected for hosted preview and release workflows.',
};
const RUNTIME_DESCRIPTIONS: Record<string, string> = {
  openclaw: 'Open-source agentic development environment and orchestration layer for coding agents.',
  hermes: 'Provider-agnostic agent framework with skills, memory, gateway integrations, cron jobs, and dashboard support.',
};

function knownRecipe(id?: string): IntegrationRecipe | undefined {
  if (!id) return undefined;
  try {
    return getIntegrationRecipe(id);
  } catch {
    return undefined;
  }
}

export function fallbackInventoryTool(id: string, category: InventoryToolStatus['category']): InventoryToolStatus {
  const recipeId = TOOL_RECIPE_IDS[id];
  const recipe = knownRecipe(recipeId);
  return {
    id,
    label: recipe?.name ?? TOOL_LABELS[id] ?? id,
    command: id,
    category,
    recipeId,
    available: false,
    status: 'not_scanned',
    version: null,
    error: 'not scanned',
  };
}

function runtimeConfig(inventory: LocalInventory | null, id: string): InventoryConfigStatus | undefined {
  if (id === 'openclaw') return inventory?.configs.openclawConfig;
  if (id === 'hermes') return inventory?.configs.hermesConfig;
  return undefined;
}

function runtimeCredentialConfig(inventory: LocalInventory | null, id: string): InventoryConfigStatus | undefined {
  if (id === 'hermes') return inventory?.configs.hermesEnv;
  return undefined;
}

function runtimeDetail(tool: InventoryToolStatus, config?: InventoryConfigStatus): string {
  if (tool.status === 'not_scanned') return 'Awaiting desktop inventory scan';
  if (tool.status === 'ready' && !tool.available) return tool.error ?? 'Detected check failed';
  if (!tool.available) return tool.error ?? 'Not found in local PATH';
  if (config && !config.exists) return 'Installed, configuration not detected';
  return tool.version ?? 'Detected';
}

function hasAnyCredentialMarker(config?: InventoryConfigStatus): boolean {
  return Boolean(config?.secrets && Object.keys(config.secrets).length > 0);
}

function runtimeReadiness(tool: InventoryToolStatus, config?: InventoryConfigStatus, credentials?: InventoryConfigStatus): LocalToolReadiness {
  if (tool.status === 'not_scanned') return 'not_scanned';
  if (tool.status === 'ready' && !tool.available) return 'broken';
  if (!tool.available) return 'missing';
  if (config && !config.exists) return 'needs_config';
  if (credentials?.exists && !hasAnyCredentialMarker(credentials)) return 'needs_credentials';
  return 'ready';
}

function toolActions(recipe?: IntegrationRecipe, installed = false): LocalToolAction[] {
  const actions: LocalToolAction[] = [];
  if (recipe) {
    actions.push({ ...safeAction('preview_install', { label: installed ? 'Preview update' : 'Preview install' }), recipeId: recipe.id });
    actions.push({ ...safeAction('configure'), recipeId: recipe.id });
    actions.push({ ...safeAction('health_check'), recipeId: recipe.id });
    actions.push({ ...safeAction('open_docs'), docsUrl: recipe.docsUrl });
  } else {
    actions.push({ ...safeAction('coming_soon', { label: 'Managed externally' }), disabled: true });
  }
  return actions;
}

function toRuntimeItem(inventory: LocalInventory | null, id: CanonicalRuntimeId): LocalToolItem {
  const inventoryKey = RUNTIME_INVENTORY_KEYS[id];
  const tool = inventory?.tools[inventoryKey] ?? fallbackInventoryTool(inventoryKey, 'agent-runtime');
  const recipe = knownRecipe(tool.recipeId ?? TOOL_RECIPE_IDS[id]);
  const config = runtimeConfig(inventory, id);
  const credentials = runtimeCredentialConfig(inventory, id);
  const readiness = runtimeReadiness(tool, config, credentials);
  return {
    id,
    label: tool.label,
    description: recipe?.description ?? RUNTIME_DESCRIPTIONS[id] ?? 'Local agent runtime detected through the desktop inventory bridge.',
    categoryId: 'agent-runtimes',
    readiness,
    version: tool.version,
    detail: runtimeDetail(tool, config),
    diagnosis: readinessDiagnosis(readiness),
    recipeId: recipe?.id,
    recipe,
    healthChecks: recipe?.healthChecks ?? [],
    config,
    actions: toolActions(recipe, tool.available),
  };
}

function toToolItem(inventory: LocalInventory | null, id: string, categoryId: 'developer-prerequisites' | 'deployment-tools'): LocalToolItem {
  const category = categoryId === 'developer-prerequisites' ? 'developer-prerequisite' : 'deployment-tool';
  const tool = inventory?.tools[id] ?? fallbackInventoryTool(id, category);
  const readiness = tool.status === 'not_scanned' ? 'not_scanned' : tool.status === 'ready' && !tool.available ? 'broken' : tool.available ? 'installed' : 'missing';
  return {
    id,
    label: tool.label,
    description: TOOL_DESCRIPTIONS[id] ?? 'Local command detected through the desktop inventory bridge.',
    categoryId,
    readiness,
    version: tool.version,
    detail: tool.status === 'not_scanned'
      ? 'Awaiting desktop inventory scan'
      : tool.status === 'ready' && !tool.available
        ? tool.error ?? 'Detected check failed'
      : tool.available
        ? tool.version ?? 'Detected'
        : tool.error ?? 'Not found in local PATH',
    diagnosis: readinessDiagnosis(readiness),
    recipeId: tool.recipeId,
    recipe: knownRecipe(tool.recipeId),
    healthChecks: [],
    actions: [{ ...safeAction('health_check'), disabled: true, title: 'Preview only; no arbitrary command execution from the renderer.' }],
  };
}

function toServiceItem(service: InventoryServiceStatus): LocalToolItem {
  const readiness = service.running ? 'running' : 'stopped';
  return {
    id: service.id,
    label: service.label,
    description: service.port ? `Expected localhost listener on port ${service.port}.` : 'Generic local process detection from sanitized inventory.',
    categoryId: 'running-services',
    readiness,
    version: null,
    detail: service.detail ?? (service.running ? 'Running' : 'Stopped'),
    diagnosis: readinessDiagnosis(readiness),
    healthChecks: [],
    service,
    actions: [
      { ...safeAction('health_check'), disabled: true, title: 'Service health execution is not wired yet.' },
      { ...safeAction('coming_soon', { label: 'Manage' }), disabled: true, title: 'Start/stop controls require explicit main-process recipes.' },
    ],
  };
}

export function buildLocalToolCategories(inventory: LocalInventory | null): LocalToolCategory[] {
  const services = Object.values(inventory?.services ?? {});
  return [
    {
      id: 'agent-runtimes',
      title: 'Agent runtimes',
      subtitle: 'Claude Code, Codex CLI, Gemini CLI, Hermes, and OpenClaw',
      items: RUNTIME_IDS.map((id) => toRuntimeItem(inventory, id)),
    },
    {
      id: 'developer-prerequisites',
      title: 'Developer prerequisites',
      subtitle: 'Core local tools used by installer recipes and runtime workflows',
      items: PREREQUISITE_IDS.map((id) => toToolItem(inventory, id, 'developer-prerequisites')),
    },
    {
      id: 'deployment-tools',
      title: 'Deployment tools',
      subtitle: 'Hosted preview and release CLIs detected locally',
      items: DEPLOYMENT_IDS.map((id) => toToolItem(inventory, id, 'deployment-tools')),
    },
    {
      id: 'running-services',
      title: 'Running services',
      subtitle: 'Hermes and OpenClaw local service health from process and port checks',
      items: services.map(toServiceItem),
    },
  ];
}

export function localToolSummary(categories: LocalToolCategory[]) {
  const items = categories.flatMap((category) => category.items);
  return {
    installed: items.filter((item) => item.readiness === 'ready' || item.readiness === 'installed' || item.readiness === 'running').length,
    missing: items.filter((item) => item.readiness === 'missing' || item.readiness === 'stopped').length,
    needsConfig: items.filter((item) => item.readiness === 'needs_config').length,
    needsCredentials: items.filter((item) => item.readiness === 'needs_credentials').length,
    notScanned: items.filter((item) => item.readiness === 'not_scanned').length,
    recipes: listIntegrationRecipes().length,
  };
}
