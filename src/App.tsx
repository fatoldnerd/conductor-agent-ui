import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconActivity,
  IconAgents,
  IconBell,
  IconCommand,
  IconDashboard,
  IconInfo,
  IconLogo,
  IconPause,
  IconPlay,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTeams,
  IconTools,
  IconWorkflow,
} from './components/Icons';
import {
  listIntegrationRecipes,
  planIntegrationInstall,
  type IntegrationInstallPlan,
  type IntegrationRecipe,
} from './integrations/recipes';
import {
  buildLocalToolCategories,
  isDetectedLocalToolItem,
  localToolSummary,
  type LocalToolAction,
  type LocalToolCategory,
  type LocalToolItem,
} from './localTools';
import { runtimeAvailable } from './agentRuntimeAvailability';
import { deriveInventoryViewState } from './inventoryViewState';
import { buildRuntimeActionApprovalQueueViewModel } from './runtimeActionApprovalQueueViewModel';
import { buildRuntimeActionHistorySourceState } from './runtimeActionHistorySource';
import type { RuntimeActionAuditPersistenceReadResult } from './runtimeActionAuditPersistence';
import { readinessLabel } from './runtimeReadiness';
import type {
  AgentRunEvent,
  AgentRunSnapshot,
  AgentRuntimeDescriptor,
  AgentRuntimeId,
  IntegrationInstallRun,
  LocalInventory,
} from './electron';

type View = 'dashboard' | 'agents' | 'teams' | 'workflows' | 'tools' | 'console' | 'integrations' | 'activity' | 'diagnostics';

const NAV: {
  id: View;
  label: string;
  icon: (p: { width?: number; height?: number }) => JSX.Element;
  badge?: string;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
  { id: 'agents', label: 'Agents', icon: IconAgents },
  { id: 'teams', label: 'Teams', icon: IconTeams },
  { id: 'workflows', label: 'Workflows', icon: IconWorkflow },
  { id: 'tools', label: 'Agent Runtimes', icon: IconTools },
  { id: 'console', label: 'Agent Console', icon: IconPlay },
  { id: 'integrations', label: 'Installers', icon: IconCommand, badge: String(listIntegrationRecipes().length) },
  { id: 'activity', label: 'Activity', icon: IconActivity },
  { id: 'diagnostics', label: 'Diagnostics', icon: IconInfo },
];

const TITLES: Record<View, { title: string; crumb: string }> = {
  dashboard: { title: 'Overview', crumb: 'Live operations' },
  agents: { title: 'Agents', crumb: 'All running and idle agents' },
  teams: { title: 'Teams', crumb: 'Coordinated agent squads' },
  workflows: { title: 'Workflows', crumb: 'Pipelines and graphs' },
  tools: { title: 'Agent Runtimes', crumb: 'Local runtimes, tools, and services' },
  console: { title: 'Agent Console', crumb: 'Read-only local agent invocations' },
  integrations: { title: 'Installers', crumb: 'Guided agent runtime setup' },
  activity: { title: 'Activity', crumb: 'Real-time event stream' },
  diagnostics: { title: 'Diagnostics', crumb: 'Desktop readiness checks' },
};

export default function App() {
  const [view, setView] = useState<View>('tools');

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} />
      <div className="main">
        <TopBar view={view} />
        <div className="view">
          {view === 'dashboard' && <DashboardView setView={setView} />}
          {view === 'agents' && <AgentsView />}
          {view === 'teams' && <TeamsView />}
          {view === 'workflows' && <WorkflowsView />}
          {view === 'tools' && <ToolsView setView={setView} />}
          {view === 'console' && <AgentConsoleView />}
          {view === 'integrations' && <IntegrationsView />}
          {view === 'activity' && <ActivityView />}
          {view === 'diagnostics' && <DiagnosticsView />}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Sidebar */

function Sidebar({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <IconLogo />
        </span>
        <span className="brand-text">
          <strong>Conductor</strong>
          <span>Orchestration</span>
        </span>
      </div>

      <nav className="nav-section">
        <div className="nav-label">Workspace</div>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => setView(item.id)}
            >
              <Icon />
              <span>{item.label}</span>
              {item.badge && <span className="badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <nav className="nav-section">
        <div className="nav-label">Project</div>
        <button className="nav-item">
          <IconCommand />
          <span>Runs</span>
        </button>
        <button className="nav-item">
          <IconSettings />
          <span>Settings</span>
        </button>
      </nav>

      <div className="sidebar-foot">
        <span className="avatar">CW</span>
        <span className="meta">
          <strong>Conductor Workspace</strong>
          <span>Desktop control plane</span>
        </span>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------- TopBar */

function TopBar({ view }: { view: View }) {
  const t = TITLES[view];
  return (
    <header className="topbar">
      <h1>{t.title}</h1>
      <span className="crumb">/ {t.crumb}</span>
      <div className="search">
        <IconSearch />
        <span>Search agents, runs, tools…</span>
        <kbd>⌘K</kbd>
      </div>
      <div className="top-actions">
        <button className="icon-btn" aria-label="Notifications">
          <IconBell />
        </button>
        <button className="icon-btn" aria-label="Settings">
          <IconSettings />
        </button>
      </div>
      <button className="primary-btn">
        <IconPlus />
        New run
      </button>
    </header>
  );
}

/* -------------------------------------------------------------- Dashboard */

function DashboardView({ setView }: { setView: (v: View) => void }) {
  const [inventory, setInventory] = useState<LocalInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const desktopAvailable = Boolean(window.conductor);

  const runScan = async () => {
    if (!window.conductor) return;
    setLoading(true);
    setInventoryError(null);
    try {
      setInventory(await window.conductor.system.collectInventory());
    } catch (err) {
      setInventory(null);
      setInventoryError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runScan();
  }, []);

  const categories = useMemo(() => buildLocalToolCategories(inventory), [inventory]);
  const summary = useMemo(() => localToolSummary(categories), [categories]);
  const inventoryState = useMemo(
    () => deriveInventoryViewState({ desktopAvailable, loading, error: inventoryError, inventory, categories }),
    [categories, desktopAvailable, inventory, inventoryError, loading],
  );
  const installedTools = categories
    .flatMap((category) => category.items)
    .filter(isDetectedLocalToolItem);
  const agentRuntimes = installedTools.filter((item) => item.categoryId === 'agent-runtimes');
  const prerequisites = installedTools.filter((item) => item.categoryId === 'developer-prerequisites');
  const runningServices = installedTools.filter((item) => item.categoryId === 'running-services' && item.readiness === 'running');

  if (!desktopAvailable) {
    return (
      <div className="local-tools-page">
        <div className="card local-tools-hero">
          <span className="eyebrow">{inventoryState.eyebrow}</span>
          <h2>{inventoryState.title}</h2>
          <p>{inventoryState.body}</p>
          <div className="actions">
            <button className="btn-ghost primary" disabled>{inventoryState.primaryAction}</button>
            <button className="btn-ghost" onClick={() => setView('tools')}>Open Agent Runtimes</button>
            <span className="hint">{inventoryState.hint}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="local-tools-page">
      <div className="card local-tools-hero">
        <span className="eyebrow">{inventoryState.eyebrow}</span>
        <h2>{inventoryState.title}</h2>
        <p>{inventoryState.body}</p>
        <div className="actions">
          <button className="btn-ghost primary" onClick={runScan} disabled={loading}>
            {loading ? 'Scanning...' : inventoryState.primaryAction}
          </button>
          <button className="btn-ghost" onClick={() => setView('tools')}>Manage Agent Runtimes</button>
          <span className="hint">{inventoryState.hint}</span>
        </div>
      </div>

      <div className="runtime-overview-grid">
        <RuntimeMetric label="Ready tools" value={summary.installed} />
        <RuntimeMetric label="Need config" value={summary.needsConfig} />
        <RuntimeMetric label="Missing/stopped" value={summary.missing} />
        <RuntimeMetric label="Running services" value={runningServices.length} />
      </div>

      <section className="split">
        <DashboardInventoryList title="Installed agent runtimes" items={agentRuntimes} empty="No agent runtimes detected yet." />
        <DashboardInventoryList title="Core prerequisites found" items={prerequisites} empty="No core prerequisites detected yet." />
      </section>

      <DashboardInventoryList title="Running local services" items={runningServices} empty="No managed local services are running." />
    </div>
  );
}

function DashboardInventoryList({ title, items, empty }: { title: string; items: LocalToolItem[]; empty: string }) {
  return (
    <div className="card local-tool-section">
      <div className="section-head compact">
        <h2>{title}</h2>
        <span className="hint">Detected only</span>
      </div>
      <div className="local-tool-list">
        {items.map((item) => (
          <div className="local-tool-row dashboard-tool-row" key={`${title}-${item.id}`}>
            <span className={`status-dot ${statusDotClass(item.readiness)}`} />
            <div className="local-tool-main">
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
            <span className={`chip ${statusChipClass(item.readiness)}`}>{readinessLabel(item.readiness)}</span>
          </div>
        ))}
        {!items.length && <p className="empty-state">{empty}</p>}
      </div>
    </div>
  );
}

function OperationalEmptyState({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  const desktopAvailable = Boolean(window.conductor);
  return (
    <div className="local-tools-page">
      <div className="card local-tools-hero">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="actions">
          <button className="btn-ghost primary" disabled>
            {desktopAvailable ? 'Awaiting local data source' : 'Requires desktop bridge'}
          </button>
          <span className="hint">
            {desktopAvailable
              ? 'Desktop mode is active; no real data source is connected for this view.'
              : 'Browser mode cannot inspect local operational state.'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Operational empty states */

function AgentsView() {
  return (
    <OperationalEmptyState
      eyebrow="Agents"
      title="No real agent run history is connected yet"
      body="This desktop screen will show agents only after Conductor has a local run store or a trusted runtime API to read from. It does not display sample agents or inferred running state."
    />
  );
}

/* -------------------------------------------------------------- Teams view */

function TeamsView() {
  return (
    <OperationalEmptyState
      eyebrow="Teams"
      title="No real team orchestration source is connected yet"
      body="Teams will appear here only after they are loaded from a local Conductor data source. This screen does not synthesize squads, members, or running status."
    />
  );
}

/* -------------------------------------------------------------- Workflow view */

function WorkflowsView() {
  return (
    <OperationalEmptyState
      eyebrow="Workflows"
      title="No real workflow graph is connected yet"
      body="A workflow canvas will render only when Conductor can load actual local workflow definitions and run state. No live graph or node status is fabricated."
    />
  );
}

/* -------------------------------------------------------------- Tools view */

function ToolsView({ setView }: { setView: (v: View) => void }) {
  const [inventory, setInventory] = useState<LocalInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<LocalToolAction['kind']>('preview_install');
  const desktopAvailable = Boolean(window.conductor);

  const runScan = async () => {
    if (!window.conductor) return;
    setLoading(true);
    setInventoryError(null);
    try {
      setInventory(await window.conductor.system.collectInventory());
    } catch (err) {
      setInventory(null);
      setInventoryError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runScan();
  }, []);

  const categories = useMemo(() => buildLocalToolCategories(inventory), [inventory]);
  const summary = useMemo(() => localToolSummary(categories), [categories]);
  const inventoryState = useMemo(
    () => deriveInventoryViewState({ desktopAvailable, loading, error: inventoryError, inventory, categories }),
    [categories, desktopAvailable, inventory, inventoryError, loading],
  );
  const selectedItem = categories.flatMap((category) => category.items).find((item) => item.recipeId === selectedRecipeId) ?? null;
  const selectedRecipe = selectedItem?.recipe ?? null;
  const selectedHealthChecks = selectedItem?.healthChecks ?? [];
  const selectedActionMetadata = selectedItem?.actions.find((action) => action.kind === selectedAction) ?? null;

  const selectAction = (item: LocalToolItem, action: LocalToolAction) => {
    if (action.kind === 'open_docs' && action.docsUrl) {
      window.open(action.docsUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!item.recipeId) return;
    setSelectedRecipeId(item.recipeId);
    setSelectedAction(action.kind);
  };

  if (!desktopAvailable) {
    return (
      <div className="local-tools-page">
        <div className="card local-tools-hero">
          <span className="eyebrow">{inventoryState.eyebrow}</span>
          <h2>{inventoryState.title}</h2>
          <p>{inventoryState.body}</p>
          <div className="actions">
            <button className="btn-ghost primary" disabled>{inventoryState.primaryAction}</button>
            <button className="btn-ghost" onClick={() => setView('integrations')}>Open recipe previews</button>
            <span className="hint">{inventoryState.hint}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="local-tools-page">
      <div className="card local-tools-hero">
        <span className="eyebrow">{inventoryState.eyebrow}</span>
        <h2>{inventoryState.title}</h2>
        <p>{inventoryState.body}</p>
        <div className="actions">
          <button className="btn-ghost primary" onClick={runScan} disabled={loading}>
            {loading ? 'Scanning...' : inventoryState.primaryAction}
          </button>
          <span className="hint">{inventoryState.hint}</span>
        </div>
      </div>

      <div className="runtime-overview-grid">
        <RuntimeMetric label="Ready" value={summary.installed} />
        <RuntimeMetric label="Needs config" value={summary.needsConfig} />
        <RuntimeMetric label="Missing or stopped" value={summary.missing} />
        <RuntimeMetric label="Not scanned" value={summary.notScanned} />
      </div>

      <div className="local-tools-sections">
        {categories.map((category) => (
          <LocalToolSection
            key={category.id}
            category={category}
            selectedRecipeId={selectedRecipeId}
            onAction={selectAction}
          />
        ))}
      </div>

      <div className="card install-preview-panel runtime-action-panel">
        <div className="section-head compact">
          <h2>Action preview</h2>
          <span className="hint">Renderer-safe; no arbitrary command execution</span>
        </div>
        {selectedRecipe ? (
          <>
            <div className="install-preview-head">
              <div>
                <strong>{selectedRecipe.name}</strong>
                <span>{selectedActionLabel(selectedAction)} preflight · {selectedRecipe.description}</span>
              </div>
              <div className="actions">
                <button className="btn-ghost" onClick={() => window.open(selectedRecipe.docsUrl, '_blank', 'noopener,noreferrer')}>Open docs</button>
                <button className="btn-ghost primary" onClick={() => setView('integrations')}>Open installer workflow</button>
              </div>
            </div>
            {selectedActionMetadata && <ActionPreflightDetails action={selectedActionMetadata} />}
            {selectedAction === 'health_check' ? (
              <HealthPreview checks={selectedHealthChecks} />
            ) : selectedAction === 'configure' ? (
              <RecipeStepPreview steps={selectedRecipe.install.steps.filter((step) => step.kind === 'configure' || step.kind === 'manual')} empty="No configure step is published for this recipe yet." />
            ) : (
              <RecipeStepPreview steps={selectedRecipe.install.steps} empty="No install preview is available for this recipe." />
            )}
            <div className="install-callout runtime-callout">
              <IconInfo />
              <span>
                This panel previews recipe metadata and health checks only. It does not accept shell input and it does
                not run commands from the renderer.
              </span>
            </div>
          </>
        ) : (
          <p className="empty-state">Select a preview action on an agent runtime to inspect suggested preflight details. Nothing runs from this panel.</p>
        )}
      </div>
    </div>
  );
}

function ActionPreflightDetails({ action }: { action: LocalToolAction }) {
  return (
    <div className="install-callout runtime-callout">
      <IconInfo />
      <span>
        Suggested next step only. No command will run without explicit approval. Expected effect: {action.preflight.expectedEffect} Risk: {action.preflight.riskLevel}. Approval: {approvalModeLabel(action.approval.mode)}. Execution contract: {executionContractLabel(action.executionContract.status)}. Request envelope: {action.requestEnvelope?.submitState ?? 'not prepared'}. Approval workflow: {action.approvalWorkflow?.state ?? 'not prepared'}; {action.approvalWorkflow?.approvalPrompt ?? 'No approval workflow item has been prepared.'} {action.executionContract.reason} {action.approval.userFacingSummary}
      </span>
    </div>
  );
}

function approvalModeLabel(mode: LocalToolAction['approval']['mode']) {
  if (mode === 'future_approval_required') return 'future action would require approval';
  if (mode === 'blocked_until_desktop_allowlisted') return 'blocked until an allowlisted desktop API exists';
  return 'not required for this non-mutating preview';
}

function executionContractLabel(status: LocalToolAction['executionContract']['status']) {
  if (status === 'desktop_api_gated') return 'allowlisted desktop API gated';
  if (status === 'blocked_unallowlisted') return 'blocked until allowlisted';
  return 'metadata only';
}

function RuntimeMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="card runtime-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LocalToolSection({
  category,
  selectedRecipeId,
  onAction,
}: {
  category: LocalToolCategory;
  selectedRecipeId: string | null;
  onAction: (item: LocalToolItem, action: LocalToolAction) => void;
}) {
  return (
    <div className="card local-tool-section">
      <div className="section-head compact">
        <h2>{category.title}</h2>
        <span className="hint">{category.subtitle}</span>
      </div>
      <div className="local-tool-list">
        {category.items.map((tool) => (
          <div className="local-tool-row" key={tool.id}>
            <span className={`status-dot ${statusDotClass(tool.readiness)}`} />
            <div className="local-tool-main">
              <strong>{tool.label}</strong>
              <span>{tool.categoryLabel}{tool.version ? ` · ${tool.version}` : ''}</span>
              <span>{tool.diagnosis}</span>
              <span>{tool.detail}</span>
              {tool.supportHint && <em>{tool.supportHint}</em>}
              <em>{tool.description}</em>
            </div>
            <span className={`chip ${statusChipClass(tool.readiness)}`}>
              {readinessLabel(tool.readiness)}
            </span>
            <div className="tool-row-actions">
              {tool.primaryAction && (
                <span className="chip chip-muted" title={tool.primaryAction.description}>
                  {tool.primaryAction.previewOnly ? 'Suggested preview' : 'Primary'}: {tool.primaryAction.label}
                </span>
              )}
              {tool.actions.map((action) => (
                <button
                  className={`btn-ghost ${selectedRecipeId === action.recipeId && action.kind === 'preview_install' ? 'primary' : ''}`}
                  disabled={action.disabled}
                  key={`${tool.id}-${action.kind}`}
                  onClick={() => onAction(tool, action)}
                  title={action.title ?? action.description}
                >
                  {actionButtonLabel(action)}
                </button>
              ))}
            </div>
            {tool.detailPanel && <RuntimeDetailPanel tool={tool} />}
          </div>
        ))}
        {!category.items.length && <p className="empty-state">No local services detected yet. Refresh inventory from the desktop app.</p>}
      </div>
    </div>
  );
}

function RuntimeDetailPanel({ tool }: { tool: LocalToolItem }) {
  const panel = tool.detailPanel;
  if (!panel) return null;

  return (
    <div className="runtime-detail-panel">
      <div className="runtime-detail-head">
        <div>
          <strong>{panel.title}</strong>
          <span>{panel.summary}</span>
        </div>
        {tool.primaryAction && (
          <span className="chip chip-muted" title={tool.primaryAction.description}>
            {tool.primaryAction.previewOnly ? 'Preview' : 'Action'}: {tool.primaryAction.label}
          </span>
        )}
      </div>
      <div className="runtime-detail-grid">
        {panel.rows.map((row) => (
          <div className="runtime-detail-row" key={`${tool.id}-${row.label}`}>
            <span>{row.label}</span>
            <strong className={row.tone ? `runtime-detail-${row.tone}` : undefined}>{row.value}</strong>
          </div>
        ))}
      </div>
      <div className="runtime-detail-next">
        {panel.nextSteps.map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>
    </div>
  );
}

function actionButtonLabel(action: LocalToolAction) {
  if (!action.previewOnly) return action.label;
  if (action.label.toLowerCase().startsWith('preview')) return action.label;
  return `Preview ${action.label.toLowerCase()}`;
}

function RecipeStepPreview({ steps, empty }: { steps: IntegrationRecipe['install']['steps']; empty: string }) {
  if (!steps.length) return <p className="empty-state">{empty}</p>;
  return (
    <div className="install-step-list compact">
      {steps.map((step, index) => (
        <div className="install-step" key={step.id}>
          <span className="step-number">{index + 1}</span>
          <div>
            <strong>{step.title}</strong>
            <span>{step.description}</span>
          </div>
          <span className={`chip ${step.requiresApproval ? 'chip-muted' : 'chip-ok'}`}>
            {step.requiresApproval ? 'Approval' : step.kind}
          </span>
        </div>
      ))}
    </div>
  );
}

function HealthPreview({ checks }: { checks: LocalToolItem['healthChecks'] }) {
  if (!checks.length) return <p className="empty-state">No health checks are published for this runtime yet.</p>;
  return (
    <div className="install-step-list compact">
      {checks.map((check, index) => (
        <div className="install-step" key={check.id}>
          <span className="step-number">{index + 1}</span>
          <div>
            <strong>{check.label}</strong>
            <span>{check.command} {check.args.join(' ')} · expects {check.expected}</span>
          </div>
          <span className="chip chip-muted">Preview</span>
        </div>
      ))}
    </div>
  );
}

function statusDotClass(readiness: LocalToolItem['readiness']) {
  if (readiness === 'ready' || readiness === 'installed' || readiness === 'running') return 'ok';
  if (readiness === 'needs_config' || readiness === 'needs_credentials') return 'warn';
  if (readiness === 'broken') return 'missing';
  if (readiness === 'not_scanned') return '';
  return 'missing';
}

function statusChipClass(readiness: LocalToolItem['readiness']) {
  if (readiness === 'ready' || readiness === 'installed' || readiness === 'running') return 'chip-ok';
  if (readiness === 'needs_config' || readiness === 'needs_credentials') return 'chip-warn';
  return 'chip-muted';
}

function selectedActionLabel(action: LocalToolAction['kind']) {
  const labels: Record<LocalToolAction['kind'], string> = {
    preview_install: 'Install preview',
    configure: 'Configuration preview',
    health_check: 'Health check preview',
    open_docs: 'Documentation',
    copy_install_command: 'Copy install command',
    refresh: 'Inventory refresh',
    coming_soon: 'Coming soon',
    requires_desktop: 'Requires desktop',
  };
  return labels[action];
}

/* -------------------------------------------------------------- Integrations view */

function getBrowserPlatform(): 'darwin' | 'linux' | 'win32' {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('mac')) return 'darwin';
  if (platform.includes('win')) return 'win32';
  return 'linux';
}

function IntegrationsView() {
  const [recipes] = useState<IntegrationRecipe[]>(listIntegrationRecipes());
  const [selectedId, setSelectedId] = useState('hermes-agent');
  const [plan, setPlan] = useState<IntegrationInstallPlan | null>(() => planIntegrationInstall('hermes-agent', getBrowserPlatform()));
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [installRun, setInstallRun] = useState<IntegrationInstallRun | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState('');
  const desktopAvailable = Boolean(window.conductor?.integrations);

  useEffect(() => {
    if (window.conductor?.integrations) {
      selectRecipe(recipes.find((recipe) => recipe.id === selectedId) ?? recipes[0]);
    }
  }, []);

  useEffect(() => {
    if (!window.conductor?.integrations?.onInstallOutput) return;
    return window.conductor.integrations.onInstallOutput((payload) => {
      setInstallLog((current) => `${current}${payload.chunk}`);
    });
  }, []);

  const selectRecipe = async (recipe: IntegrationRecipe) => {
    setSelectedId(recipe.id);
    setError(null);
    setInstallRun(null);
    setInstallLog('');
    setApproved(false);
    try {
      const nextPlan = window.conductor?.integrations
        ? await window.conductor.integrations.planInstall(recipe.id)
        : planIntegrationInstall(recipe.id, getBrowserPlatform());
      setPlan(nextPlan as IntegrationInstallPlan);
    } catch (err) {
      setPlan(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const startApprovedInstall = async () => {
    if (!selected || !window.conductor?.integrations || !approved) return;
    setError(null);
    setInstalling(true);
    setInstallLog('');
    try {
      const run = await window.conductor.integrations.createInstallRun(selected.id);
      setInstallRun(run);
      const finished = await window.conductor.integrations.runInstallSequence(run.id);
      setInstallRun(finished);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (installRun) {
        const latest = await window.conductor.integrations.getInstallRun(installRun.id).catch(() => null);
        if (latest) setInstallRun(latest);
      }
    } finally {
      setInstalling(false);
    }
  };

  const selected = recipes.find((recipe) => recipe.id === selectedId) ?? recipes[0];

  return (
    <div className="integrations-layout">
      <div className="integration-list">
        {recipes.map((recipe) => (
          <button
            className={`integration-card card ${recipe.id === selected?.id ? 'selected' : ''}`}
            key={recipe.id}
            onClick={() => selectRecipe(recipe)}
          >
            <span className="integration-mark">{recipe.shortName.slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{recipe.name}</strong>
              <span>{recipe.description}</span>
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="card install-panel">
          <div className="section-head compact">
            <div>
              <h2>{selected.name}</h2>
              <span className="hint">{selected.category} · {selected.supportedPlatforms.join(', ')}</span>
            </div>
            <span className="chip chip-muted">Preview</span>
          </div>

          <p className="panel-copy">{selected.description}</p>

          <div className="install-meta">
            <div>
              <span>Providers</span>
              <strong>{selected.providerRequirements.join(', ')}</strong>
            </div>
            <div>
              <span>Prerequisites</span>
              <strong>{selected.prerequisites.join(', ')}</strong>
            </div>
          </div>

          <div className="install-callout">
            <IconInfo />
            <span>
              This is an execution preview. The web app cannot execute commands. In the Electron desktop app,
              Conductor requires both this UI acknowledgement and a native main-process approval dialog before any command runs.
            </span>
          </div>

          {error && <div className="install-error">{error}</div>}

          {plan && (
            <div className="install-steps">
              {plan.steps.map((step, index) => (
                <div className="install-step" key={step.id}>
                  <span className="step-num">{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                    <code>{step.command}</code>
                  </div>
                  <span className={`chip ${step.requiresApproval ? 'chip-muted' : 'chip-ok'}`}>
                    {step.requiresApproval ? 'Approval' : step.kind}
                  </span>
                </div>
              ))}
            </div>
          )}

          {installRun && (
            <div className="run-status-panel">
              <div className="section-head compact">
                <h2>Execution run</h2>
                <span className={`chip ${installRun.status === 'failed' ? 'chip-muted' : 'chip-ok'}`}>{installRun.status}</span>
              </div>
              <div className="run-step-list">
                {installRun.steps.map((step) => (
                  <div className="run-step-row" key={step.id}>
                    <span className={`status-dot ${step.status === 'succeeded' ? 'ok' : step.status === 'failed' ? 'missing' : ''}`} />
                    <strong>{step.title}</strong>
                    <span>{step.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {installLog && <pre className="install-log">{installLog}</pre>}

          <div className="approval-panel">
            <label>
              <input
                type="checkbox"
                checked={approved}
                disabled={!desktopAvailable || installing}
                onChange={(event) => setApproved(event.currentTarget.checked)}
              />
              <span>I understand Conductor will show a native approval dialog before executing the trusted main-process commands above.</span>
            </label>
            {!desktopAvailable && <p>Installer execution is available only in the Electron desktop app. The web deployment remains preview-only.</p>}
          </div>

          <div className="actions">
            <button className="btn-ghost primary" onClick={startApprovedInstall} disabled={!desktopAvailable || !approved || installing}>
              {installing ? 'Running installer…' : 'Approve and run sequence'}
            </button>
            <button className="btn-ghost" onClick={() => selectRecipe(selected)} disabled={installing}>Refresh preview</button>
            <button className="btn-ghost" onClick={() => window.open(selected.docsUrl, '_blank', 'noopener,noreferrer')}>Open docs</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Diagnostics view */

function DiagnosticsView() {
  const [inventory, setInventory] = useState<LocalInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const desktopAvailable = Boolean(window.conductor);

  const runChecks = async () => {
    if (!window.conductor) return;
    setLoading(true);
    setInventoryError(null);
    try {
      const nextInventory = await window.conductor.system.collectInventory();
      setInventory(nextInventory);
    } catch (err) {
      setInventory(null);
      setInventoryError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runChecks();
  }, []);

  const diagnosticCategories = useMemo(() => buildLocalToolCategories(inventory), [inventory]);
  const inventoryState = useMemo(
    () => deriveInventoryViewState({ desktopAvailable, loading, error: inventoryError, inventory, categories: diagnosticCategories }),
    [desktopAvailable, diagnosticCategories, inventory, inventoryError, loading],
  );

  if (!desktopAvailable) {
    return (
      <div className="diagnostics-grid">
        <div className="card diagnostic-hero">
          <span className="eyebrow">{inventoryState.eyebrow}</span>
          <h2>{inventoryState.title}</h2>
          <p>{inventoryState.body}</p>
          <div className="actions">
            <button className="btn-ghost primary" disabled>{inventoryState.primaryAction}</button>
            <span className="hint">{inventoryState.hint}</span>
          </div>
        </div>
      </div>
    );
  }

  const toolEntries = Object.entries(inventory?.tools ?? {});
  const hasLocalOpenClaw = Boolean(
    inventory?.tools.openclaw?.available ||
    inventory?.services.openclaw?.running ||
    inventory?.configs.openclawConfig?.exists,
  );
  const serviceEntries = Object.entries(inventory?.services ?? {}).filter(([id]) => id !== 'openclaw');
  const configEntries = Object.entries(inventory?.configs ?? {});
  const availableCount = toolEntries.filter(([, check]) => check.available).length;
  const runningCount = serviceEntries.filter(([, service]) => service.running).length;

  return (
    <div className="diagnostics-grid">
      <div className="card diagnostic-hero">
        <span className="eyebrow">{inventoryState.eyebrow}</span>
        <h2>{inventoryState.title}</h2>
        <p>{inventoryState.body}</p>
        <div className="actions">
          <button className="btn-ghost primary" onClick={runChecks} disabled={loading}>
            {loading ? 'Scanning...' : inventoryState.primaryAction}
          </button>
          <span className="hint">{inventory ? `${availableCount} tools · ${runningCount} services running` : inventoryState.hint}</span>
        </div>
      </div>

      {inventory && (
        <div className="card diagnostic-panel">
          <div className="section-head compact">
            <h2>Machine</h2>
            <span className="hint">Collected {new Date(inventory.collectedAt).toLocaleTimeString()}</span>
          </div>
          <div className="kv-grid">
            <div><span>Platform</span><strong>{inventory.machine.platform}</strong></div>
            <div><span>Architecture</span><strong>{inventory.machine.arch}</strong></div>
            <div><span>OS release</span><strong>{inventory.machine.osRelease}</strong></div>
            <div><span>Hostname</span><strong>Hidden in UI</strong></div>
            <div><span>Desktop capable</span><strong>{inventory.machine.desktopCapable ? 'Yes' : 'No'}</strong></div>
            <div><span>Bridge smoke</span><strong>{inventory.desktopSmoke.status === 'ready' ? 'Ready' : 'Needs attention'}</strong></div>
            <div className="wide"><span>Home directory</span><strong>Collected by main process, not displayed</strong></div>
          </div>
        </div>
      )}

      <div className="card diagnostic-panel wide-panel">
        <div className="section-head compact">
          <h2>Agent services</h2>
          <span className="hint">Process and port health</span>
        </div>
        <div className="check-list">
          {serviceEntries.map(([name, service]) => (
            <div className="check-row" key={name}>
              <span className={`status-dot ${service.running ? 'ok' : 'missing'}`} />
              <div>
                <strong>{service.label}</strong>
                <span>{service.detail ?? (service.port ? `Expected port ${service.port}` : 'Process detection')}</span>
              </div>
              <span className={`chip ${service.running ? 'chip-ok' : service.status === 'port_in_use' ? 'chip-warn' : 'chip-muted'}`}>
                {service.running ? 'Running' : service.status === 'port_in_use' ? 'Port in use' : 'Stopped'}
              </span>
            </div>
          ))}
          {!serviceEntries.length && <p className="empty-state">Run the desktop app to collect service status.</p>}
        </div>
      </div>

      {inventory && hasLocalOpenClaw && (
        <div className="card diagnostic-panel wide-panel">
          <div className="section-head compact">
            <h2>OpenClaw management</h2>
            <span className="hint">Shown only for local OpenClaw detection</span>
          </div>
          <div className="check-list">
            <div className="check-row">
              <span className={`status-dot ${inventory.tools.openclaw?.available ? 'ok' : 'missing'}`} />
              <div>
                <strong>OpenClaw CLI</strong>
                <span>{inventory.tools.openclaw?.version ?? inventory.tools.openclaw?.error ?? 'not found'}</span>
              </div>
              <span className={`chip ${inventory.tools.openclaw?.available ? 'chip-ok' : 'chip-muted'}`}>
                {inventory.tools.openclaw?.available ? 'Detected' : 'Missing'}
              </span>
            </div>
            <div className="check-row">
              <span className={`status-dot ${inventory.services.openclaw?.running ? 'ok' : 'missing'}`} />
              <div>
                <strong>OpenClaw runtime</strong>
                <span>Generic local process detection</span>
              </div>
              <span className={`chip ${inventory.services.openclaw?.running ? 'chip-ok' : 'chip-muted'}`}>
                {inventory.services.openclaw?.running ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="check-row">
              <span className={`status-dot ${inventory.configs.openclawConfig?.exists ? 'ok' : 'missing'}`} />
              <div>
                <strong>OpenClaw configuration</strong>
                <span>{inventory.configs.openclawConfig?.exists ? 'Config file presence detected' : 'No config file detected'}</span>
              </div>
              <span className={`chip ${inventory.configs.openclawConfig?.exists ? 'chip-ok' : 'chip-muted'}`}>
                {inventory.configs.openclawConfig?.exists ? 'Found' : 'Missing'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="card diagnostic-panel wide-panel">
        <div className="section-head compact">
          <h2>Agent tooling</h2>
          <span className="hint">Installed CLI readiness</span>
        </div>
        <div className="check-list">
          {toolEntries.map(([name, check]) => (
            <div className="check-row" key={name}>
              <span className={`status-dot ${check.available ? 'ok' : 'missing'}`} />
              <div>
                <strong>{check.label ?? name}</strong>
                <span>{check.available ? check.version : check.error ?? 'not found'}</span>
              </div>
              <span className={`chip ${check.available ? 'chip-ok' : 'chip-muted'}`}>
                {check.available ? 'Available' : 'Missing'}
              </span>
            </div>
          ))}
          {!toolEntries.length && <p className="empty-state">Run the desktop app to collect tool status.</p>}
        </div>
      </div>

      <div className="card diagnostic-panel wide-panel">
        <div className="section-head compact">
          <h2>Configuration</h2>
          <span className="hint">Presence only, values redacted</span>
        </div>
        <div className="check-list">
          {configEntries.map(([name, config]) => (
            <div className="check-row" key={name}>
              <span className={`status-dot ${config.exists ? 'ok' : 'missing'}`} />
              <div>
                <strong>{name}</strong>
                <span>{config.exists ? 'Config file presence detected' : 'Expected config file not detected'}</span>
                {config.secrets && Object.keys(config.secrets).length > 0 && (
                  <span>{Object.keys(config.secrets).length} secret marker(s) present; names and values hidden</span>
                )}
              </div>
              <span className={`chip ${config.exists ? 'chip-ok' : 'chip-muted'}`}>
                {config.exists ? 'Found' : 'Missing'}
              </span>
            </div>
          ))}
          {!configEntries.length && <p className="empty-state">Run the desktop app to collect config status.</p>}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Activity view */

function ActivityView() {
  const desktopAvailable = Boolean(window.conductor);
  const [historyPersistence, setHistoryPersistence] = useState<RuntimeActionAuditPersistenceReadResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadRuntimeActionHistory = async () => {
    if (!window.conductor?.runtimeActions) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const persistence = await window.conductor.runtimeActions.getAuditHistory();
      setHistoryPersistence(persistence as RuntimeActionAuditPersistenceReadResult);
    } catch {
      setHistoryPersistence(null);
      setHistoryError('Runtime action history could not be loaded. Details were redacted for display.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadRuntimeActionHistory();
  }, []);

  const runtimeActionHistorySource = useMemo(
    () => buildRuntimeActionHistorySourceState({
      desktopBridgeAvailable: desktopAvailable,
      sourceKind: historyPersistence ? 'electron-local' : undefined,
      persistence: historyPersistence ?? undefined,
      error: historyError,
    }),
    [desktopAvailable, historyError, historyPersistence],
  );
  const runtimeActionHistory = runtimeActionHistorySource.viewModel;
  const runtimeActionApprovalQueue = useMemo(() => buildRuntimeActionApprovalQueueViewModel([]), []);

  return (
    <div className="local-tools-page">
      <div className="card local-tools-hero">
        <span className="eyebrow">Activity</span>
        <h2>{runtimeActionHistory.empty ? runtimeActionHistory.emptyTitle : 'Runtime action history'}</h2>
        <p>{runtimeActionHistorySource.message}</p>
        <div className="actions">
          <button className="btn-ghost primary" onClick={loadRuntimeActionHistory} disabled={!window.conductor?.runtimeActions || historyLoading}>
            {runtimeActionHistorySource.status === 'desktop_required'
              ? 'Requires desktop bridge'
              : historyLoading
                ? 'Loading audit history...'
                : 'Refresh audit history'}
          </button>
          <span className="hint">No fake live activity is rendered. {historyError ? 'Last read failed safely.' : ''}</span>
        </div>
      </div>

      <div className="runtime-overview-grid">
        <RuntimeMetric label="History entries" value={runtimeActionHistory.stats.total} />
        <RuntimeMetric label="Pending approval" value={runtimeActionHistory.stats.pendingApproval} />
        <RuntimeMetric label="Blocked" value={runtimeActionHistory.stats.blocked} />
        <RuntimeMetric label="Completed" value={runtimeActionHistory.stats.completed} />
      </div>

      <div className="card local-tool-section">
        <div className="section-head compact">
          <h2>Approval queue</h2>
          <span className="hint">Non-executing shell · no fake approvals</span>
        </div>
        {runtimeActionApprovalQueue.empty ? (
          <p className="empty-state">{runtimeActionApprovalQueue.emptyBody}</p>
        ) : (
          <div className="local-tool-list">
            {runtimeActionApprovalQueue.entries.map((entry) => (
              <div className="local-tool-row" key={entry.correlationId}>
                <span className="status-dot" />
                <div className="local-tool-main">
                  <strong>{entry.title}</strong>
                  <span>{entry.subtitle}</span>
                  <em>{entry.safetyNote}</em>
                </div>
                <span className="chip chip-warn">{entry.riskLabel}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card local-tool-section">
        <div className="section-head compact">
          <h2>Runtime action history</h2>
          <span className="hint">Sanitized audit model only</span>
        </div>
        {runtimeActionHistory.empty ? (
          <p className="empty-state">{runtimeActionHistory.emptyBody}</p>
        ) : (
          <div className="local-tool-list">
            {runtimeActionHistory.entries.map((entry) => (
              <div className="local-tool-row" key={entry.correlationId}>
                <span className={`status-dot ${entry.tone === 'ok' ? 'ok' : entry.tone === 'danger' ? 'missing' : ''}`} />
                <div className="local-tool-main">
                  <strong>{entry.title}</strong>
                  <span>{entry.subtitle}</span>
                  <em>{entry.eventCount} sanitized event(s) from {entry.sourceLabel}</em>
                </div>
                <span className={`chip ${entry.tone === 'ok' ? 'chip-ok' : entry.tone === 'danger' ? 'chip-warn' : 'chip-muted'}`}>{entry.state}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Agent Console view */

type ConsoleEntry = {
  id: string;
  kind: 'prompt' | 'stdout' | 'stderr' | 'status' | 'error' | 'system';
  text: string;
  at: string;
};

function AgentConsoleView() {
  const desktopAvailable = Boolean(window.conductor?.agents);
  const [runtimes, setRuntimes] = useState<AgentRuntimeDescriptor[]>([]);
  const [inventory, setInventory] = useState<LocalInventory | null>(null);
  const [runtimeId, setRuntimeId] = useState<AgentRuntimeId | null>(null);
  const [projectPath, setProjectPath] = useState('');
  const [projectStatus, setProjectStatus] = useState<{ valid: boolean; error?: string } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [activeRun, setActiveRun] = useState<AgentRunSnapshot | null>(null);
  const [transcript, setTranscript] = useState<ConsoleEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const entryCounter = useRef(0);

  const appendEntry = (kind: ConsoleEntry['kind'], text: string) => {
    entryCounter.current += 1;
    const id = `${Date.now()}-${entryCounter.current}`;
    setTranscript((prev) => [...prev, { id, kind, text, at: new Date().toISOString() }]);
  };

  useEffect(() => {
    if (!window.conductor?.agents) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await window.conductor!.agents.listRuntimes();
        if (cancelled) return;
        setRuntimes(list);
        const inv = await window.conductor!.system.collectInventory().catch(() => null);
        if (cancelled) return;
        setInventory(inv);
        const firstAvailable = list.find((runtime) => runtimeAvailable(runtime, inv));
        setRuntimeId((firstAvailable ?? list[0])?.id ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window.conductor?.agents?.onRunEvent) return;
    return window.conductor.agents.onRunEvent((eventPayload: AgentRunEvent) => {
      setActiveRun((current) => {
        if (!current || current.runId !== eventPayload.runId) return current;
        if (eventPayload.type === 'status') {
          return {
            ...current,
            status: eventPayload.status,
            exitCode: eventPayload.exitCode ?? current.exitCode ?? null,
            finishedAt: eventPayload.finishedAt ?? current.finishedAt,
          };
        }
        return current;
      });
      if (eventPayload.type === 'stdout') appendEntry('stdout', eventPayload.chunk);
      else if (eventPayload.type === 'stderr') appendEntry('stderr', eventPayload.chunk);
      else if (eventPayload.type === 'error') appendEntry('error', eventPayload.message);
      else if (eventPayload.type === 'status') {
        appendEntry('status', `status → ${eventPayload.status}${typeof eventPayload.exitCode === 'number' ? ` (exit ${eventPayload.exitCode})` : ''}`);
      }
    });
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: 'end' });
  }, [transcript]);

  useEffect(() => {
    if (!window.conductor?.agents) return;
    if (!projectPath.trim()) {
      setProjectStatus(null);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const result = await window.conductor!.agents.validateProject(projectPath.trim());
        if (cancelled) return;
        setProjectStatus(result.valid ? { valid: true } : { valid: false, error: result.error });
      } catch (err) {
        if (cancelled) return;
        setProjectStatus({ valid: false, error: err instanceof Error ? err.message : String(err) });
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [projectPath]);

  const selectedRuntime = runtimes.find((runtime) => runtime.id === runtimeId) ?? null;
  const runtimeReady = selectedRuntime ? runtimeAvailable(selectedRuntime, inventory) : false;
  const runActive = Boolean(activeRun && ['starting', 'running', 'cancelling'].includes(activeRun.status));
  const canStart = Boolean(
    desktopAvailable &&
      selectedRuntime &&
      runtimeReady &&
      projectStatus?.valid &&
      prompt.trim().length > 0 &&
      !submitting &&
      !runActive,
  );

  const startRun = async () => {
    if (!canStart || !selectedRuntime || !window.conductor?.agents) return;
    setSubmitting(true);
    setError(null);
    appendEntry('prompt', prompt.trim());
    try {
      const result = await window.conductor.agents.startRun({
        runtimeId: selectedRuntime.id,
        projectPath: projectPath.trim(),
        prompt: prompt.trim(),
        mode: 'read-only',
      });
      setActiveRun(result.snapshot);
      appendEntry('system', `Started ${selectedRuntime.label} (run ${result.runId.slice(0, 14)}…) in ${result.snapshot.cwd}`);
      setPrompt('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      appendEntry('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const stopRun = async () => {
    if (!activeRun || !window.conductor?.agents) return;
    try {
      const snapshot = await window.conductor.agents.stopRun(activeRun.runId);
      setActiveRun(snapshot);
      appendEntry('system', 'Stop signal sent (SIGTERM).');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      appendEntry('error', message);
    }
  };

  const clearTranscript = () => {
    setTranscript([]);
    setActiveRun((current) => (current && !runActive ? null : current));
  };

  if (!desktopAvailable) {
    return (
      <div className="agent-console-page">
        <div className="card local-tools-hero">
          <span className="eyebrow">Desktop bridge required</span>
          <h2>Agent Console runs only inside the Conductor desktop app</h2>
          <p>
            The browser preview cannot spawn local processes. Open the Electron build to invoke installed agent CLIs in
            read-only mode against a local project directory.
          </p>
          <div className="actions">
            <button className="btn-ghost primary" disabled>Requires desktop bridge</button>
            <span className="hint">Run `npm run desktop:dev` locally.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-console-page">
      <div className="card local-tools-hero">
        <span className="eyebrow">Read-only agent invocation</span>
        <h2>Run a local agent CLI against a project directory</h2>
        <p>
          The renderer only sends a structured request — runtime, project path, prompt, mode. The Electron main process
          owns the command recipes, validates the working directory, and streams stdout, stderr, and status back. Write
          mode is intentionally not implemented in this slice.
        </p>
      </div>

      <div className="agent-console-grid">
        <div className="card agent-console-controls">
          <div className="section-head compact">
            <h2>Runtime</h2>
            <span className="hint">{runtimes.length} allowlisted recipes</span>
          </div>
          <div className="agent-runtime-list">
            {runtimes.map((runtime) => {
              const available = runtimeAvailable(runtime, inventory);
              const selected = runtime.id === runtimeId;
              const awaitingInventory = !inventory && !runtime.needsValidation;
              return (
                <button
                  type="button"
                  key={runtime.id}
                  className={`agent-runtime-row ${selected ? 'selected' : ''}`}
                  disabled={!available || runActive}
                  onClick={() => setRuntimeId(runtime.id)}
                  title={runtime.notes.join(' ')}
                >
                  <span className={`status-dot ${available ? 'ok' : awaitingInventory ? '' : 'missing'}`} />
                  <span className="agent-runtime-main">
                    <strong>{runtime.label}</strong>
                    <span>{runtime.description}</span>
                  </span>
                  <span className={`chip ${available ? 'chip-ok' : 'chip-muted'}`}>
                    {runtime.needsValidation ? 'Needs validation' : available ? 'Available' : awaitingInventory ? 'Awaiting inventory' : 'Missing'}
                  </span>
                </button>
              );
            })}
            {!runtimes.length && <p className="empty-state">No agent runtimes allowlisted.</p>}
          </div>

          <div className="section-head compact">
            <h2>Project directory</h2>
            <span className="hint">Absolute local path; main process validates</span>
          </div>
          <input
            type="text"
            className="agent-console-input"
            placeholder="/Users/you/code/your-project"
            value={projectPath}
            onChange={(event) => setProjectPath(event.currentTarget.value)}
            disabled={runActive}
            spellCheck={false}
          />
          {projectStatus?.error && <div className="agent-console-hint error">{projectStatus.error}</div>}
          {projectStatus?.valid && <div className="agent-console-hint ok">Validated as a local directory.</div>}

          <div className="section-head compact">
            <h2>Mode</h2>
            <span className="hint">Read-only only in this slice</span>
          </div>
          <div className="agent-mode-row">
            <span className="chip chip-ok">read-only</span>
            <span className="agent-console-hint">Write mode is not implemented yet.</span>
          </div>

          <div className="install-callout agent-console-callout">
            <IconInfo />
            <span>
              Conductor sends only {'{'} runtimeId, projectPath, prompt, mode {'}'} to the main process. Command,
              args, env, and shell handling live in the trusted main-process recipe and are never exposed to the
              renderer.
            </span>
          </div>
        </div>

        <div className="card agent-console-transcript">
          <div className="section-head compact">
            <h2>Transcript</h2>
            <span className={`chip ${runActive ? 'chip-ok' : 'chip-muted'}`}>
              {activeRun ? `${activeRun.status}${typeof activeRun.exitCode === 'number' ? ` · exit ${activeRun.exitCode}` : ''}` : 'idle'}
            </span>
          </div>
          <div className="agent-transcript">
            {transcript.length === 0 && (
              <div className="empty-state">
                Compose a prompt and start a read-only run. Output streams here as the main process reports stdout,
                stderr, and status events.
              </div>
            )}
            {transcript.map((entry) => (
              <div key={entry.id} className={`agent-transcript-entry ${entry.kind}`}>
                <span className="agent-transcript-tag">{entry.kind}</span>
                <pre>{entry.text}</pre>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>

          <div className="agent-prompt-row">
            <textarea
              className="agent-console-input prompt"
              rows={3}
              value={prompt}
              onChange={(event) => setPrompt(event.currentTarget.value)}
              placeholder="Describe what the agent should look at (read-only)…"
              disabled={runActive}
            />
            <div className="agent-prompt-actions">
              <button className="btn-ghost primary" onClick={startRun} disabled={!canStart}>
                <IconPlay width={11} height={11} /> Start run
              </button>
              <button className="btn-ghost" onClick={stopRun} disabled={!runActive}>
                <IconPause width={11} height={11} /> Stop
              </button>
              <button className="btn-ghost" onClick={clearTranscript} disabled={runActive || !transcript.length}>
                Clear
              </button>
            </div>
          </div>

          {error && <div className="install-error agent-console-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
