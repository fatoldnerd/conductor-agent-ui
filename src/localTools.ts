import type { InventoryConfigStatus, InventoryServiceStatus, InventoryToolStatus, LocalInventory } from './electron';
import { getIntegrationRecipe, listIntegrationRecipes, type IntegrationHealthCheck, type IntegrationRecipe } from './integrations/recipes';
import { buildRuntimeActionApproval, type RuntimeActionApprovalPolicy } from './runtimeActionApproval';
import {
  CANONICAL_RUNTIME_IDS,
  RUNTIME_CATEGORY_LABELS,
  RUNTIME_INVENTORY_KEYS,
  readinessDiagnosis,
  readinessLabel,
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
  approval: RuntimeActionApprovalPolicy;
};

export type LocalRuntimeDetailRow = {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'muted' | 'danger';
};

export type LocalRuntimeDetailPanel = {
  title: string;
  summary: string;
  rows: LocalRuntimeDetailRow[];
  nextSteps: string[];
};

export type LocalToolItem = {
  id: string;
  label: string;
  description: string;
  categoryId: LocalToolCategoryId;
  categoryLabel: string;
  readiness: LocalToolReadiness;
  version: string | null;
  detail: string;
  diagnosis: string;
  supportHint?: string;
  primaryAction?: LocalToolAction;
  recipeId?: string;
  recipe?: IntegrationRecipe;
  healthChecks: IntegrationHealthCheck[];
  config?: InventoryConfigStatus;
  service?: InventoryServiceStatus;
  detailPanel?: LocalRuntimeDetailPanel;
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
const RUNTIME_DETAIL_COPY: Record<CanonicalRuntimeId, { title: string; evidenceLabel: string; missingStep: string }> = {
  'claude-code': {
    title: 'Claude Code runtime details',
    evidenceLabel: 'Claude CLI evidence',
    missingStep: 'Install Claude Code or refresh inventory after making it available on PATH.',
  },
  'codex-cli': {
    title: 'Codex CLI runtime details',
    evidenceLabel: 'Codex CLI evidence',
    missingStep: 'Install Codex CLI or refresh inventory after making it available on PATH.',
  },
  'gemini-cli': {
    title: 'Gemini CLI runtime details',
    evidenceLabel: 'Gemini CLI evidence',
    missingStep: 'Install Gemini CLI or refresh inventory after making it available on PATH.',
  },
  hermes: {
    title: 'Hermes runtime details',
    evidenceLabel: 'Hermes CLI evidence',
    missingStep: 'Preview the Hermes setup recipe, then configure Hermes outside the renderer.',
  },
  openclaw: {
    title: 'OpenClaw runtime details',
    evidenceLabel: 'OpenClaw CLI evidence',
    missingStep: 'Preview the OpenClaw setup recipe, then refresh inventory after setup.',
  },
};
const RUNTIME_SERVICE_IDS: Partial<Record<CanonicalRuntimeId, string[]>> = {
  hermes: ['hermesGateway', 'hermesDashboard', 'hermesApi'],
  openclaw: ['openclaw'],
};
const CATEGORY_LABELS: Record<LocalToolCategoryId, string> = {
  'agent-runtimes': RUNTIME_CATEGORY_LABELS['agent-runtime'],
  'developer-prerequisites': RUNTIME_CATEGORY_LABELS['developer-prerequisite'],
  'deployment-tools': RUNTIME_CATEGORY_LABELS['deployment-tool'],
  'running-services': RUNTIME_CATEGORY_LABELS.service,
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
  if (tool.status === 'broken' || (tool.status === 'ready' && !tool.available)) return tool.error ?? 'Detected check failed';
  if (!tool.available) return tool.error ?? 'Not found in local PATH';
  if (config && !config.exists) return 'Installed, configuration not detected';
  return tool.version ?? 'Detected';
}

function hasAnyCredentialMarker(config?: InventoryConfigStatus): boolean {
  return Boolean(config?.secrets && Object.keys(config.secrets).length > 0);
}

function runtimeReadiness(tool: InventoryToolStatus, config?: InventoryConfigStatus, credentials?: InventoryConfigStatus): LocalToolReadiness {
  if (tool.status === 'not_scanned') return 'not_scanned';
  if (tool.status === 'broken' || (tool.status === 'ready' && !tool.available)) return 'broken';
  if (!tool.available) return 'missing';
  if (config && !config.exists) return 'needs_config';
  if (credentials?.exists && !hasAnyCredentialMarker(credentials)) return 'needs_credentials';
  return 'ready';
}

function withApproval(action: RuntimeActionMetadata, extras: Omit<LocalToolAction, keyof RuntimeActionMetadata | 'approval'> = {}): LocalToolAction {
  return { ...action, ...extras, approval: buildRuntimeActionApproval(action) };
}

function toolActions(recipe?: IntegrationRecipe, installed = false): LocalToolAction[] {
  const actions: LocalToolAction[] = [];
  if (recipe) {
    actions.push(withApproval(safeAction('preview_install', { label: installed ? 'Preview update' : 'Preview install' }), { recipeId: recipe.id }));
    actions.push(withApproval(safeAction('configure'), { recipeId: recipe.id }));
    actions.push(withApproval(safeAction('health_check'), { recipeId: recipe.id }));
    actions.push(withApproval(safeAction('open_docs'), { docsUrl: recipe.docsUrl }));
  } else {
    actions.push(withApproval(safeAction('coming_soon', { label: 'Managed externally' }), { disabled: true }));
  }
  return actions;
}

function primaryActionFor(readiness: LocalToolReadiness, actions: LocalToolAction[]): LocalToolAction | undefined {
  if (readiness === 'not_scanned') {
    return withApproval(safeAction('refresh'), { disabled: true, title: 'Use Refresh inventory above to scan from the desktop app.' });
  }
  if (readiness === 'needs_config' || readiness === 'needs_credentials') {
    return actions.find((action) => action.kind === 'configure') ?? actions.find((action) => !action.disabled);
  }
  if (readiness === 'ready' || readiness === 'installed' || readiness === 'running') {
    return actions.find((action) => action.kind === 'health_check') ?? actions.find((action) => !action.disabled);
  }
  if (readiness === 'missing') {
    return actions.find((action) => action.kind === 'preview_install') ?? actions.find((action) => action.kind === 'open_docs');
  }
  return actions.find((action) => !action.disabled);
}

function actionModeLabel(action: LocalToolAction): string {
  if (action.previewOnly) return 'Preview only';
  if (action.requiresDesktop) return 'Desktop action';
  return 'Safe action';
}

function runtimeSupportHint(recipe?: IntegrationRecipe, config?: InventoryConfigStatus, credentials?: InventoryConfigStatus): string | undefined {
  if (config && !config.exists) return 'Configuration file was not detected. Use Configure for safe setup guidance.';
  if (credentials?.exists && !hasAnyCredentialMarker(credentials)) return 'Credential markers were not detected. Configure credentials outside the renderer.';
  if (recipe?.docsUrl) return 'Documentation is available from the runtime recipe.';
  return undefined;
}

function readinessNextStep(readiness: LocalToolReadiness, runtimeId: CanonicalRuntimeId, action?: LocalToolAction): string {
  if (readiness === 'ready' || readiness === 'installed' || readiness === 'running') {
    return action
      ? `${actionModeLabel(action)}: ${action.description}`
      : 'Use Conductor only after a trusted desktop inventory scan confirms this runtime.';
  }
  if (readiness === 'not_scanned') return 'Refresh inventory from the desktop app before treating this runtime as installed or missing.';
  if (readiness === 'needs_config') return 'Open configuration guidance and complete setup outside the renderer.';
  if (readiness === 'needs_credentials') return 'Add required credentials in the runtime-owned config path, then refresh inventory.';
  if (readiness === 'broken') return 'Inspect the sanitized error detail and rerun the desktop inventory scan after fixing the runtime.';
  if (readiness === 'unsupported') return 'Use this runtime only on a supported desktop platform.';
  if (readiness === 'stopped') return 'Start the local service outside Conductor or use an approved future service action.';
  return RUNTIME_DETAIL_COPY[runtimeId].missingStep;
}

function serviceDetailValue(service: InventoryServiceStatus): string {
  if (service.status === 'port_in_use') {
    if (service.portState === 'ssh_tunnel') return service.detail ?? 'Port is in use by an SSH tunnel, not a confirmed local service.';
    return service.detail ?? 'Port is in use by another process, not a confirmed local service.';
  }
  if (service.running) return service.port ? `Running on expected local port ${service.port}` : 'Running process detected';
  return service.port ? `Stopped; expected local port ${service.port} is not confirmed running` : 'Stopped';
}

function serviceTone(service: InventoryServiceStatus): LocalRuntimeDetailRow['tone'] {
  if (service.running) return 'ok';
  if (service.status === 'port_in_use') return 'warn';
  return 'muted';
}

function buildRuntimeDetailPanel(
  inventory: LocalInventory | null,
  id: CanonicalRuntimeId,
  tool: InventoryToolStatus,
  readiness: LocalToolReadiness,
  action: LocalToolAction | undefined,
  config?: InventoryConfigStatus,
  credentials?: InventoryConfigStatus,
): LocalRuntimeDetailPanel {
  const copy = RUNTIME_DETAIL_COPY[id];
  const rows: LocalRuntimeDetailRow[] = [
    { label: 'Readiness', value: readinessDiagnosis(readiness), tone: readiness === 'ready' ? 'ok' : readiness === 'broken' ? 'danger' : readiness === 'needs_config' || readiness === 'needs_credentials' ? 'warn' : 'muted' },
    { label: copy.evidenceLabel, value: runtimeDetail(tool, config), tone: readiness === 'ready' ? 'ok' : readiness === 'broken' ? 'danger' : 'muted' },
  ];

  if (tool.version) rows.push({ label: 'Version', value: tool.version, tone: 'ok' });
  if (config) rows.push({ label: 'Configuration', value: config.exists ? 'Configuration marker detected by desktop inventory.' : 'Configuration marker was not detected.', tone: config.exists ? 'ok' : 'warn' });
  if (credentials) rows.push({
    label: 'Credentials',
    value: hasAnyCredentialMarker(credentials)
      ? 'Credential markers detected without exposing secret values.'
      : 'Credential markers were not detected.',
    tone: hasAnyCredentialMarker(credentials) ? 'ok' : 'warn',
  });

  for (const serviceId of RUNTIME_SERVICE_IDS[id] ?? []) {
    const service = inventory?.services[serviceId];
    if (!service) continue;
    rows.push({
      label: service.label,
      value: serviceDetailValue(service),
      tone: serviceTone(service),
    });
  }

  rows.push({
    label: 'Next safe action',
    value: action ? `${action.label} (${actionModeLabel(action).toLowerCase()})` : 'No renderer action is available.',
    tone: action?.disabled ? 'muted' : 'ok',
  });
  if (action?.preflight) {
    rows.push(
      { label: 'Preflight risk', value: `${action.preflight.riskLevel} risk`, tone: action.preflight.riskLevel === 'high' ? 'danger' : action.preflight.riskLevel === 'medium' ? 'warn' : 'muted' },
      { label: 'Expected effect', value: action.preflight.expectedEffect, tone: 'muted' },
      { label: 'Approval', value: action.preflight.requiresApproval ? 'Runtime readiness is not blocked. Only a future Conductor-triggered action would ask for explicit approval first.' : 'No approval is required for this non-mutating action.', tone: 'muted' },
      { label: 'Requirements', value: action.preflight.requirements.join(' '), tone: 'muted' },
    );
  }

  return {
    title: copy.title,
    summary: `${tool.label} is ${readinessLabel(readiness).toLowerCase()}. ${readinessDiagnosis(readiness)}`,
    rows,
    nextSteps: [readinessNextStep(readiness, id, action)],
  };
}

function toRuntimeItem(inventory: LocalInventory | null, id: CanonicalRuntimeId): LocalToolItem {
  const inventoryKey = RUNTIME_INVENTORY_KEYS[id];
  const tool = inventory?.tools[inventoryKey] ?? fallbackInventoryTool(inventoryKey, 'agent-runtime');
  const recipe = knownRecipe(tool.recipeId ?? TOOL_RECIPE_IDS[id]);
  const config = runtimeConfig(inventory, id);
  const credentials = runtimeCredentialConfig(inventory, id);
  const readiness = runtimeReadiness(tool, config, credentials);
  const actions = toolActions(recipe, tool.available);
  const primaryAction = primaryActionFor(readiness, actions);
  return {
    id,
    label: tool.label,
    description: recipe?.description ?? RUNTIME_DESCRIPTIONS[id] ?? 'Local agent runtime detected through the desktop inventory bridge.',
    categoryId: 'agent-runtimes',
    categoryLabel: CATEGORY_LABELS['agent-runtimes'],
    readiness,
    version: tool.version,
    detail: runtimeDetail(tool, config),
    diagnosis: readinessDiagnosis(readiness),
    supportHint: runtimeSupportHint(recipe, config, credentials),
    recipeId: recipe?.id,
    recipe,
    healthChecks: recipe?.healthChecks ?? [],
    config,
    actions,
    primaryAction,
    detailPanel: buildRuntimeDetailPanel(inventory, id, tool, readiness, primaryAction, config, credentials),
  };
}

function toToolItem(inventory: LocalInventory | null, id: string, categoryId: 'developer-prerequisites' | 'deployment-tools'): LocalToolItem {
  const category = categoryId === 'developer-prerequisites' ? 'developer-prerequisite' : 'deployment-tool';
  const tool = inventory?.tools[id] ?? fallbackInventoryTool(id, category);
  const readiness = tool.status === 'not_scanned' ? 'not_scanned' : tool.status === 'broken' || (tool.status === 'ready' && !tool.available) ? 'broken' : tool.available ? 'installed' : 'missing';
  const actions: LocalToolAction[] = [withApproval(safeAction('health_check'), { disabled: true, title: 'Preview only; no arbitrary command execution from the renderer.' })];
  return {
    id,
    label: tool.label,
    description: TOOL_DESCRIPTIONS[id] ?? 'Local command detected through the desktop inventory bridge.',
    categoryId,
    categoryLabel: CATEGORY_LABELS[categoryId],
    readiness,
    version: tool.version,
    detail: tool.status === 'not_scanned'
      ? 'Awaiting desktop inventory scan'
      : tool.status === 'broken' || (tool.status === 'ready' && !tool.available)
        ? tool.error ?? 'Detected check failed'
      : tool.available
        ? tool.version ?? 'Detected'
        : tool.error ?? 'Not found in local PATH',
    diagnosis: readinessDiagnosis(readiness),
    supportHint: readiness === 'not_scanned' ? 'Run desktop inventory refresh before treating this tool as installed or missing.' : undefined,
    recipeId: tool.recipeId,
    recipe: knownRecipe(tool.recipeId),
    healthChecks: [],
    actions,
    primaryAction: primaryActionFor(readiness, actions),
  };
}

function toServiceItem(service: InventoryServiceStatus): LocalToolItem {
  const readiness = service.running ? 'running' : 'stopped';
  const actions: LocalToolAction[] = [
    withApproval(safeAction('health_check'), { disabled: true, title: 'Service health execution is not wired yet.' }),
    withApproval(safeAction('coming_soon', { label: 'Manage' }), { disabled: true, title: 'Start/stop controls require explicit main-process recipes.' }),
  ];
  return {
    id: service.id,
    label: service.label,
    description: service.port ? `Expected localhost listener on port ${service.port}.` : 'Generic local process detection from sanitized inventory.',
    categoryId: 'running-services',
    categoryLabel: CATEGORY_LABELS['running-services'],
    readiness,
    version: null,
    detail: service.detail ?? (service.running ? 'Running' : 'Stopped'),
    diagnosis: readinessDiagnosis(readiness),
    supportHint: service.status === 'port_in_use' ? 'The port is occupied, but Conductor did not confirm this is the named service.' : undefined,
    healthChecks: [],
    service,
    actions,
    primaryAction: primaryActionFor(readiness, actions),
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

export function isDetectedLocalToolItem(item: LocalToolItem): boolean {
  return ['ready', 'installed', 'running', 'needs_config', 'needs_credentials'].includes(item.readiness);
}
