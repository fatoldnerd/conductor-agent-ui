import { useEffect, useMemo, useState } from 'react';
import {
  IconActivity,
  IconAgents,
  IconBell,
  IconCommand,
  IconDashboard,
  IconInfo,
  IconLogo,
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
import { deriveInventoryViewState } from './inventoryViewState';
import {
  buildRuntimeActionApprovalDecisionHistorySourceState,
  type RuntimeActionApprovalDecisionHistorySourceState,
} from './runtimeActionApprovalDecisionHistorySource';
import { buildRuntimeActionApprovalQueueSourceState, type RuntimeActionApprovalQueueReadResult } from './runtimeActionApprovalQueueSource';
import {
  buildRuntimeActionNativeConfirmationHistorySourceState,
  type RuntimeActionNativeConfirmationHistorySourceState,
} from './runtimeActionNativeConfirmationHistorySource';
import { buildRuntimeActionHistorySourceState } from './runtimeActionHistorySource';
import type { RuntimeActionApprovalDecisionReadResult } from './runtimeActionApprovalDecisionPersistence';
import type { RuntimeActionAuditPersistenceReadResult } from './runtimeActionAuditPersistence';
import type { RuntimeActionNativeConfirmationReadResult } from './electron';
import { readinessLabel } from './runtimeReadiness';
import type {
  AgentRunEvent,
  IntegrationInstallRun,
  LocalInventory,
  MissionRepoReadinessResult,
  MissionRepoReviewStartResult,
  RuntimeActionApprovalDecisionSubmitPayload,
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
  { id: 'workflows', label: 'Mission Control', icon: IconWorkflow },
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
  workflows: { title: 'Mission Control', crumb: 'Goals, approvals, and mission progress' },
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
          {view === 'workflows' && <MissionControlView />}
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

async function refreshLocalInventory(): Promise<LocalInventory> {
  if (window.conductor?.runtimeActions?.refreshInventory) {
    const refreshInventoryResult = await window.conductor.runtimeActions.refreshInventory();
    return refreshInventoryResult.inventory;
  }
  return window.conductor!.system.collectInventory();
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
      setInventory(await refreshLocalInventory());
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

function MissionControlView() {
  const desktopAvailable = Boolean(window.conductor);
  const [missionRepoPath, setMissionRepoPath] = useState('');
  const [missionInspecting, setMissionInspecting] = useState(false);
  const [missionResult, setMissionResult] = useState<MissionRepoReadinessResult | null>(null);
  const [missionError, setMissionError] = useState<string | null>(null);
  const [missionReviewStarting, setMissionReviewStarting] = useState(false);
  const [missionReviewStart, setMissionReviewStart] = useState<MissionRepoReviewStartResult | null>(null);
  const [missionReviewTranscript, setMissionReviewTranscript] = useState<string[]>([]);
  const [missionReviewError, setMissionReviewError] = useState<string | null>(null);

  const inspectRepoReadiness = async () => {
    if (!window.conductor?.missions?.inspectRepoReadiness) return;
    setMissionInspecting(true);
    setMissionError(null);
    setMissionResult(null);
    try {
      const result = await window.conductor.missions.inspectRepoReadiness(missionRepoPath);
      if (result.rendererCanExecuteArbitraryActions || result.executedShell) {
        throw new Error('Mission bridge returned an unsafe execution result');
      }
      setMissionResult(result);
    } catch {
      setMissionError('Read-only repo inspection failed safely. No commands were executed.');
    } finally {
      setMissionInspecting(false);
    }
  };

  useEffect(() => {
    if (!window.conductor?.agents?.onRunEvent) return undefined;
    return window.conductor.agents.onRunEvent((event: AgentRunEvent) => {
      setMissionReviewStart((current) => {
        if (!current?.runId || event.runId !== current.runId) return current;
        if (event.type === 'stdout' || event.type === 'stderr') {
          setMissionReviewTranscript((entries) => [...entries, `${event.type}: ${event.chunk}`].slice(-80));
        }
        if (event.type === 'error') {
          setMissionReviewTranscript((entries) => [...entries, `error: ${event.message}`].slice(-80));
        }
        if (event.type === 'status') {
          setMissionReviewTranscript((entries) => [...entries, `status: ${event.status}`].slice(-80));
        }
        return current;
      });
    });
  }, []);

  const startReadOnlyRepoReview = async () => {
    if (!window.conductor?.missions?.startReadOnlyRepoReview) return;
    setMissionReviewStarting(true);
    setMissionReviewError(null);
    setMissionReviewTranscript([]);
    try {
      const result = await window.conductor.missions.startReadOnlyRepoReview(missionRepoPath);
      if (result.rendererCanExecuteArbitraryActions || result.executedShell) {
        throw new Error('Mission bridge returned an unsafe execution result');
      }
      setMissionReviewStart(result);
      setMissionReviewTranscript([result.message]);
    } catch {
      setMissionReviewStart(null);
      setMissionReviewError('Read-only repo review mission failed safely before agent launch or during native approval.');
    } finally {
      setMissionReviewStarting(false);
    }
  };
  const missionRiskNotes = missionResult?.summary.riskNotes ?? [];
  const missionReadinessScore = missionResult ? calculateMissionReadinessScore(missionResult) : 0;
  const missionReadinessLabel = missionResult ? formatMissionReadinessLabel(missionResult.summary.readiness) : null;

  return (
    <div className="mission-control-page">
      <div className="card mission-hero">
        <span className="eyebrow">Mission Control</span>
        <h2>First mission type: read-only repo readiness</h2>
        <p>
          Mission Control is the plain-English orchestration layer for goals, approvals, progress, and deliverables.
          The first real mission type is intentionally constrained: it can inspect allowlisted repository metadata,
          produce a readiness summary, and write an audit event. No fake missions are rendered, no agent work is started,
          and no command surface exists behind the Create Mission button.
        </p>
        <div className="actions">
          <button className="btn-ghost primary" disabled>Create mission disabled</button>
          <span className="hint">Agent execution remains parked until an allowlisted local mission runner exists.</span>
        </div>
      </div>

      <div className="mission-shell-grid">
        <section className="card mission-panel mission-goal-panel">
          <span className="eyebrow">Read-only repo readiness inspection</span>
          <label htmlFor="mission-repo-path-input">Local repository path</label>
          <input
            id="mission-repo-path-input"
            className="mission-path-input"
            value={missionRepoPath}
            onChange={(event) => setMissionRepoPath(event.target.value)}
            placeholder="/path/to/local/repo"
            disabled={!desktopAvailable || missionInspecting}
          />
          <p className="panel-copy compact">
            This uses window.conductor?.missions?.inspectRepoReadiness with only a projectPath. It reads allowlisted
            metadata files only, returns rendererCanExecuteArbitraryActions=false, and does not execute shell commands.
          </p>
          <div className="actions mission-readiness-actions">
            <button
              className="btn-ghost primary"
              onClick={inspectRepoReadiness}
              disabled={!desktopAvailable || !missionRepoPath.trim() || missionInspecting || !window.conductor?.missions?.inspectRepoReadiness}
            >
              {missionInspecting ? 'Inspecting...' : 'Run read-only readiness check'}
            </button>
            <span className="hint mission-action-safety-hint">Read-only, audited, no command allowlist.</span>
          </div>
          {missionError && <p className="empty-state">{missionError}</p>}
          {missionResult && (
            <div className="mission-result-box">
              <div className="mission-result-heading">
                <strong>{missionResult.repoName}: {missionReadinessLabel}</strong>
                <span className="mission-score">Readiness score {missionReadinessScore}/100</span>
              </div>
              <span>Package manager: {missionResult.summary.packageManager}</span>
              <span>Git: {missionResult.summary.hasGitRepository ? 'detected' : 'not detected'} · Tests: {missionResult.summary.hasTestScript ? 'detected' : 'missing'} · Build: {missionResult.summary.hasBuildScript ? 'detected' : 'missing'} · README: {missionResult.summary.hasReadme ? 'detected' : 'missing'}</span>
              {missionRiskNotes.length > 0 ? (
                <span>Risk notes: {missionRiskNotes.join(' · ')}</span>
              ) : (
                <span>No risk notes detected from allowlisted metadata.</span>
              )}
              <span>{missionResult.message}</span>
              <div className="mission-inline-next-action">
                <div className="mission-approval-box">
                  <strong>Start approved repo review</strong>
                  <span>Native approval required. Fixed runtime: Codex CLI read-only. Electron main owns the prompt and the allowlisted recipe.</span>
                </div>
                <div className="actions mission-readiness-actions">
                  <button
                    className="btn-ghost primary"
                    onClick={startReadOnlyRepoReview}
                    disabled={!desktopAvailable || !missionRepoPath.trim() || missionReviewStarting || !window.conductor?.missions?.startReadOnlyRepoReview}
                  >
                    {missionReviewStarting ? 'Requesting approval...' : 'Start approved repo review'}
                  </button>
                  <span className="hint mission-action-safety-hint">Native approval required. No generic mission execution channel.</span>
                </div>
                {missionReviewError && <p className="empty-state">{missionReviewError}</p>}
                {missionReviewStart && (
                  <div className="mission-result-box nested">
                    <div className="mission-result-heading">
                      <strong>Repo review mission: {missionReviewStart.status}</strong>
                      <span className="mission-score">{missionReviewStart.runtimeId}</span>
                    </div>
                    <span>{missionReviewStart.message}</span>
                    <span>Native approval: {missionReviewStart.nativeApproval.confirmed ? 'confirmed' : 'cancelled'}</span>
                    {missionReviewTranscript.length > 0 && <pre className="mission-review-transcript">{missionReviewTranscript.join('\n')}</pre>}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="card mission-panel">
          <span className="eyebrow">Agent readiness</span>
          <div className="mission-readiness-list">
            <MissionReadinessRow label="Agent runtimes" value="Use Agent Runtimes for live local readiness" tone="ok" />
            <MissionReadinessRow label="Read-only repo inspector" value={desktopAvailable ? 'Available in desktop bridge' : 'Requires desktop bridge'} tone={desktopAvailable ? 'ok' : 'warn'} />
            <MissionReadinessRow label="Agent mission runner" value="Native-approved Codex read-only recipe available" tone="ok" />
            <MissionReadinessRow label="Deliverable store" value="Not connected" tone="muted" />
          </div>
        </section>

        <section className="card mission-panel">
          <span className="eyebrow">Approvals required</span>
          <div className="mission-approval-box">
            <strong>No approvals pending</strong>
            <span>Read-only repo inspection does not require approval because it has no command execution path.</span>
          </div>
          <p className="panel-copy compact">Future write or run actions must flow through native approval before execution.</p>
        </section>

        <section className="card mission-panel mission-timeline-panel">
          <span className="eyebrow">Mission timeline</span>
          <div className="mission-empty-timeline">
            <strong>{missionResult ? 'Readiness inspection completed' : 'Waiting for the first real mission inspection'}</strong>
            <span>{missionResult ? 'A sanitized readiness summary is shown above. No fake timeline events were created.' : 'No fake planning, running, completed, or failed mission events are displayed.'}</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function formatMissionReadinessLabel(readiness: MissionRepoReadinessResult['summary']['readiness']) {
  if (readiness === 'ready_for_read_only_agent_review') return 'Ready for read-only agent review';
  return 'Needs attention before agent review';
}

function calculateMissionReadinessScore(result: MissionRepoReadinessResult) {
  const checks = [
    result.summary.hasGitRepository,
    result.summary.hasPackageJson || result.summary.packageManager !== 'unknown',
    result.summary.hasTestScript,
    result.summary.hasBuildScript,
    result.summary.hasReadme,
  ];
  const baseScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return Math.max(0, baseScore - result.summary.riskNotes.length * 10);
}

function MissionReadinessRow({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'muted' }) {
  return (
    <div className="mission-readiness-row">
      <span className={`status-dot ${tone === 'ok' ? 'ok' : tone === 'warn' ? 'missing' : ''}`} />
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
    </div>
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
      setInventory(await refreshLocalInventory());
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
  const balancedToolColumns = useMemo(() => buildBalancedLocalToolColumns(categories), [categories]);

  const selectAction = async (item: LocalToolItem, action: LocalToolAction) => {
    if (action.kind === 'open_docs' && action.docsUrl) {
      const openDocumentationTarget = item.recipeId;
      if (openDocumentationTarget && window.conductor?.runtimeActions?.openDocumentation) {
        await window.conductor.runtimeActions.openDocumentation(openDocumentationTarget);
        return;
      }
      window.open(action.docsUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action.kind === 'health_check') {
      const healthCheckTarget = item.recipeId;
      const healthCheckId = item.healthChecks[0]?.id;
      if (
        healthCheckTarget === 'hermes-agent'
        && healthCheckId === 'hermes-version'
        && window.conductor?.runtimeActions?.runHealthCheck
      ) {
        await window.conductor.runtimeActions.runHealthCheck(healthCheckTarget, healthCheckId);
        return;
      }
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

      <div className="local-tools-sections balanced">
        {balancedToolColumns.map((column, columnIndex) => (
          <div className="local-tools-column" key={`local-tools-column-${columnIndex}`}>
            {column.map((category) => (
              <LocalToolSection
                key={category.id}
                category={category}
                selectedRecipeId={selectedRecipeId}
                onAction={selectAction}
              />
            ))}
          </div>
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
            <p className="panel-copy compact runtime-note">
              Preview only. This panel does not accept shell input and does not run renderer-provided commands.
            </p>
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
    <div className="runtime-preflight-note">
      <p>
        Suggested next step only. No command will run without explicit approval. Expected effect: {action.preflight.expectedEffect} Risk: {action.preflight.riskLevel}. Approval: {approvalModeLabel(action.approval.mode)}. Execution contract: {executionContractLabel(action.executionContract.status)}. Request envelope: {action.requestEnvelope?.submitState ?? 'not prepared'}. Approval workflow: {action.approvalWorkflow?.state ?? 'not prepared'}; {action.approvalWorkflow?.approvalPrompt ?? 'No approval workflow item has been prepared.'} {action.executionContract.reason} {action.approval.userFacingSummary}
      </p>
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

function buildBalancedLocalToolColumns(categories: LocalToolCategory[]): LocalToolCategory[][] {
  const agentRuntimeColumn = categories.filter((category) => category.id === 'agent-runtimes');
  const supportingToolColumn = categories.filter((category) =>
    category.id === 'developer-prerequisites'
    || category.id === 'deployment-tools'
    || category.id === 'running-services'
  );
  const remaining = categories.filter((category) =>
    category.id !== 'agent-runtimes'
    && category.id !== 'developer-prerequisites'
    && category.id !== 'deployment-tools'
    && category.id !== 'running-services'
  );

  return [agentRuntimeColumn, [...supportingToolColumn, ...remaining]].filter((column) => column.length > 0);
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

          <p className="panel-copy compact">
            Preview only. Installer execution remains gated behind Electron main-process approval and is not part of the browser view.
          </p>

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
      const nextInventory = await refreshLocalInventory();
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
  const [queueReadResult, setQueueReadResult] = useState<RuntimeActionApprovalQueueReadResult | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [decisionHistoryReadResult, setDecisionHistoryReadResult] = useState<RuntimeActionApprovalDecisionReadResult | null>(null);
  const [decisionHistoryLoading, setDecisionHistoryLoading] = useState(false);
  const [decisionHistoryError, setDecisionHistoryError] = useState<string | null>(null);
  const [nativeConfirmationReadResult, setNativeConfirmationReadResult] = useState<RuntimeActionNativeConfirmationReadResult | null>(null);
  const [nativeConfirmationLoading, setNativeConfirmationLoading] = useState(false);
  const [nativeConfirmationError, setNativeConfirmationError] = useState<string | null>(null);
  const [approvalDecisionSubmittingId, setApprovalDecisionSubmittingId] = useState<string | null>(null);
  const [approvalDecisionSubmittingDecision, setApprovalDecisionSubmittingDecision] = useState<RuntimeActionApprovalDecisionSubmitPayload['decision'] | null>(null);
  const [approvalDecisionSubmitError, setApprovalDecisionSubmitError] = useState<string | null>(null);
  const [approvalDecisionSubmitMessage, setApprovalDecisionSubmitMessage] = useState<string | null>(null);

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

  const loadRuntimeActionApprovalQueue = async () => {
    if (!window.conductor?.runtimeActions) return;
    setQueueLoading(true);
    setQueueError(null);
    try {
      const queue = await window.conductor.runtimeActions.getApprovalQueue();
      setQueueReadResult(queue as RuntimeActionApprovalQueueReadResult);
    } catch {
      setQueueReadResult(null);
      setQueueError('Runtime action approval queue could not be loaded. Details were redacted for display.');
    } finally {
      setQueueLoading(false);
    }
  };

  const loadRuntimeActionApprovalDecisionHistory = async () => {
    if (!window.conductor?.runtimeActions) return;
    setDecisionHistoryLoading(true);
    setDecisionHistoryError(null);
    try {
      const decisions = await window.conductor.runtimeActions.getApprovalDecisions();
      setDecisionHistoryReadResult(decisions as RuntimeActionApprovalDecisionReadResult);
    } catch {
      setDecisionHistoryReadResult(null);
      setDecisionHistoryError('Runtime action approval decision history could not be loaded. Details were redacted for display.');
    } finally {
      setDecisionHistoryLoading(false);
    }
  };

  const loadRuntimeActionNativeConfirmationHistory = async () => {
    if (!window.conductor?.runtimeActions.getNativeConfirmations) return;
    setNativeConfirmationLoading(true);
    setNativeConfirmationError(null);
    try {
      const confirmations = await window.conductor.runtimeActions.getNativeConfirmations();
      setNativeConfirmationReadResult(confirmations);
    } catch {
      setNativeConfirmationReadResult(null);
      setNativeConfirmationError('Runtime action native confirmation history could not be loaded. Details were redacted for display.');
    } finally {
      setNativeConfirmationLoading(false);
    }
  };

  const submitRuntimeActionApprovalDecisionFromQueue = async (
    correlationId: string,
    decision: RuntimeActionApprovalDecisionSubmitPayload['decision'],
  ) => {
    if (!window.conductor?.runtimeActions.submitApprovalDecision) return;
    setApprovalDecisionSubmittingId(correlationId);
    setApprovalDecisionSubmittingDecision(decision);
    setApprovalDecisionSubmitError(null);
    setApprovalDecisionSubmitMessage(null);
    try {
      const result = await window.conductor.runtimeActions.submitApprovalDecision({
        correlationId,
        decision,
        decidedAt: new Date().toISOString(),
      });
      if (result.nativeConfirmation.required) await confirmRuntimeActionNativeApprovalDecision(result.correlationId);
      else setApprovalDecisionSubmitMessage(result.message);
      await loadRuntimeActionApprovalQueue();
      await loadRuntimeActionApprovalDecisionHistory();
      await loadRuntimeActionNativeConfirmationHistory();
    } catch {
      setApprovalDecisionSubmitError('Approval decision could not be submitted. Details were redacted for display.');
    } finally {
      setApprovalDecisionSubmittingId(null);
      setApprovalDecisionSubmittingDecision(null);
    }
  };

  const confirmRuntimeActionNativeApprovalDecision = async (correlationId: string) => {
    if (!window.conductor?.runtimeActions.confirmNativeApprovalDecision) {
      setApprovalDecisionSubmitMessage('Approved decision recorded. Native confirmation requires the desktop bridge. No action executed.');
      return;
    }
    const nativeResult = await window.conductor.runtimeActions.confirmNativeApprovalDecision({ correlationId });
    if (nativeResult.status === 'confirmed_no_execution') {
      setApprovalDecisionSubmitMessage('Native confirmation completed. No action executed.');
      return;
    }
    if (nativeResult.status === 'cancelled_no_execution') {
      setApprovalDecisionSubmitMessage('Native confirmation cancelled. No action executed.');
      return;
    }
    setApprovalDecisionSubmitError('Native confirmation could not continue. No action executed.');
  };

  useEffect(() => {
    loadRuntimeActionHistory();
    loadRuntimeActionApprovalQueue();
    loadRuntimeActionApprovalDecisionHistory();
    loadRuntimeActionNativeConfirmationHistory();
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
  const runtimeActionApprovalQueueSource = useMemo(
    () => buildRuntimeActionApprovalQueueSourceState({
      desktopBridgeAvailable: desktopAvailable,
      sourceKind: queueReadResult ? 'electron-local' : undefined,
      queue: queueReadResult ?? undefined,
      error: queueError,
    }),
    [desktopAvailable, queueError, queueReadResult],
  );
  const runtimeActionApprovalQueue = runtimeActionApprovalQueueSource.viewModel;
  const runtimeActionApprovalDecisionHistorySource: RuntimeActionApprovalDecisionHistorySourceState = useMemo(
    () => buildRuntimeActionApprovalDecisionHistorySourceState({
      desktopBridgeAvailable: desktopAvailable,
      sourceKind: decisionHistoryReadResult ? 'electron-local' : undefined,
      decisions: decisionHistoryReadResult ?? undefined,
      error: decisionHistoryError,
    }),
    [decisionHistoryError, decisionHistoryReadResult, desktopAvailable],
  );
  const runtimeActionApprovalDecisionHistory = runtimeActionApprovalDecisionHistorySource.viewModel;
  const runtimeActionNativeConfirmationHistorySource: RuntimeActionNativeConfirmationHistorySourceState = useMemo(
    () => buildRuntimeActionNativeConfirmationHistorySourceState({
      desktopBridgeAvailable: desktopAvailable,
      sourceKind: nativeConfirmationReadResult ? 'electron-local' : undefined,
      confirmations: nativeConfirmationReadResult ?? undefined,
      error: nativeConfirmationError,
    }),
    [desktopAvailable, nativeConfirmationError, nativeConfirmationReadResult],
  );
  const runtimeActionNativeConfirmationHistory = runtimeActionNativeConfirmationHistorySource.viewModel;

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
          <span className="hint">
            {runtimeActionApprovalQueueSource.status === 'desktop_required'
              ? 'Desktop required · no fake approvals'
              : queueLoading
                ? 'Loading approval queue...'
                : `${runtimeActionApprovalQueueSource.sourceKind} · no fake approvals`}
          </span>
        </div>
        {runtimeActionApprovalQueue.empty ? (
          <p className="empty-state">{runtimeActionApprovalQueue.emptyBody}</p>
        ) : (
          <div className="local-tool-list">
            {runtimeActionApprovalQueue.entries.map((entry) => {
              const isSubmittingThisDecision = approvalDecisionSubmittingId === entry.correlationId;
              return (
                <div className="local-tool-row" key={entry.correlationId}>
                  <span className="status-dot" />
                  <div className="local-tool-main">
                    <strong>{entry.title}</strong>
                    <span>{entry.subtitle}</span>
                    <em>{entry.safetyNote}</em>
                  </div>
                  <span className="chip chip-warn">{entry.riskLabel}</span>
                  <div className="actions compact-actions">
                    <button
                      className="btn-ghost primary"
                      onClick={() => submitRuntimeActionApprovalDecisionFromQueue(entry.correlationId, 'approved')}
                      disabled={!window.conductor?.runtimeActions.submitApprovalDecision || isSubmittingThisDecision || queueLoading}
                    >
                      {isSubmittingThisDecision && approvalDecisionSubmittingDecision === 'approved' ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => submitRuntimeActionApprovalDecisionFromQueue(entry.correlationId, 'rejected')}
                      disabled={!window.conductor?.runtimeActions.submitApprovalDecision || isSubmittingThisDecision || queueLoading}
                    >
                      {isSubmittingThisDecision && approvalDecisionSubmittingDecision === 'rejected' ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="actions">
          <button
            className="btn-ghost"
            onClick={loadRuntimeActionApprovalQueue}
            disabled={!window.conductor?.runtimeActions || queueLoading || Boolean(approvalDecisionSubmittingId)}
          >
            {queueLoading ? 'Loading approval queue...' : 'Refresh approval queue'}
          </button>
          <span className="hint">
            No command executes from these controls. Approved items still require future native confirmation. {approvalDecisionSubmitError ? 'Last submit failed safely.' : approvalDecisionSubmitMessage ? 'Last decision recorded.' : ''}
          </span>
        </div>
      </div>

      <div className="card local-tool-section">
        <div className="section-head compact">
          <h2>Approval decisions</h2>
          <span className="hint">
            {runtimeActionApprovalDecisionHistorySource.status === 'desktop_required'
              ? 'Desktop required · no fake decisions'
              : decisionHistoryLoading
                ? 'Loading approval decisions...'
                : `${runtimeActionApprovalDecisionHistorySource.sourceKind} · read-only decisions`}
          </span>
        </div>
        {runtimeActionApprovalDecisionHistory.empty ? (
          <p className="empty-state">{runtimeActionApprovalDecisionHistory.emptyBody}</p>
        ) : (
          <div className="local-tool-list">
            {runtimeActionApprovalDecisionHistory.entries.map((entry) => (
              <div className="local-tool-row" key={entry.correlationId}>
                <span className={`status-dot ${entry.tone === 'ok' ? 'ok' : entry.tone === 'warn' ? 'missing' : ''}`} />
                <div className="local-tool-main">
                  <strong>{entry.title}</strong>
                  <span>{entry.subtitle}</span>
                  <em>{entry.safetyNote}</em>
                </div>
                <span className={`chip ${entry.tone === 'ok' ? 'chip-ok' : entry.tone === 'warn' ? 'chip-warn' : 'chip-muted'}`}>{entry.decision}</span>
              </div>
            ))}
          </div>
        )}
        <div className="actions">
          <button
            className="btn-ghost"
            onClick={loadRuntimeActionApprovalDecisionHistory}
            disabled={!window.conductor?.runtimeActions || decisionHistoryLoading}
          >
            {decisionHistoryLoading ? 'Loading decisions...' : 'Refresh approval decisions'}
          </button>
          <span className="hint">Read-only history. {decisionHistoryError ? 'Last read failed safely.' : ''}</span>
        </div>
      </div>

      <div className="card local-tool-section">
        <div className="section-head compact">
          <h2>Native confirmations</h2>
          <span className="hint">
            {runtimeActionNativeConfirmationHistorySource.status === 'desktop_required'
              ? 'Desktop required · no fake confirmations'
              : nativeConfirmationLoading
                ? 'Loading native confirmations...'
                : `${runtimeActionNativeConfirmationHistorySource.sourceKind} · no action executed`}
          </span>
        </div>
        {runtimeActionNativeConfirmationHistory.empty ? (
          <p className="empty-state">{runtimeActionNativeConfirmationHistory.emptyBody}</p>
        ) : (
          <div className="local-tool-list">
            {runtimeActionNativeConfirmationHistory.entries.map((entry) => (
              <div className="local-tool-row" key={entry.correlationId}>
                <span className={`status-dot ${entry.tone === 'ok' ? 'ok' : entry.tone === 'warn' ? 'missing' : ''}`} />
                <div className="local-tool-main">
                  <strong>{entry.title}</strong>
                  <span>{entry.subtitle}</span>
                  <em>{entry.executionNote}</em>
                </div>
                <span className={`chip ${entry.tone === 'ok' ? 'chip-ok' : entry.tone === 'warn' ? 'chip-warn' : 'chip-muted'}`}>{entry.status}</span>
              </div>
            ))}
          </div>
        )}
        <div className="actions">
          <button
            className="btn-ghost"
            onClick={loadRuntimeActionNativeConfirmationHistory}
            disabled={!window.conductor?.runtimeActions || nativeConfirmationLoading}
          >
            {nativeConfirmationLoading ? 'Loading native confirmations...' : 'Refresh native confirmations'}
          </button>
          <span className="hint">No action executed from native confirmation. {nativeConfirmationError ? 'Last read failed safely.' : ''}</span>
        </div>
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

function AgentConsoleView() {
  return (
    <div className="agent-console-page">
      <div className="card local-tools-hero">
        <span className="eyebrow">Parked</span>
        <h2>Agent Console is parked until the local run bridge is reliable</h2>
        <p>
          The previous console controls looked active but were not reliable enough for a desktop-first operator flow.
          This tab now stays honest: no fake transcript, no half-working run form, and no command execution surface until
          the allowlisted local agent runner is ready.
        </p>
        <div className="actions">
          <button className="btn-ghost primary" disabled>Console parked</button>
          <span className="hint">Use Agent Runtimes for the currently supported desktop actions.</span>
        </div>
      </div>
    </div>
  );
}
