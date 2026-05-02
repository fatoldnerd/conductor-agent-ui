import { useEffect, useMemo, useState } from 'react';
import {
  IconActivity,
  IconAgents,
  IconAlert,
  IconArrowDown,
  IconArrowUp,
  IconBell,
  IconCheck,
  IconCommand,
  IconCross,
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
  activity,
  agents,
  stats,
  teams,
  toolMeta,
  tools,
  workflow,
} from './data/mockData';
import {
  listIntegrationRecipes,
  planIntegrationInstall,
  type IntegrationInstallPlan,
  type IntegrationRecipe,
} from './integrations/recipes';
import type {
  ActivityEvent,
  Agent,
  AgentStatus,
  Stat,
  Team,
  Tool,
  ToolId,
  ToolStatus,
  Workflow,
} from './types';

type View = 'dashboard' | 'agents' | 'teams' | 'workflows' | 'tools' | 'integrations' | 'activity' | 'diagnostics';

const NAV: {
  id: View;
  label: string;
  icon: (p: { width?: number; height?: number }) => JSX.Element;
  badge?: string;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
  { id: 'agents', label: 'Agents', icon: IconAgents, badge: String(agents.length) },
  { id: 'teams', label: 'Teams', icon: IconTeams, badge: String(teams.length) },
  { id: 'workflows', label: 'Workflows', icon: IconWorkflow },
  { id: 'tools', label: 'Tools', icon: IconTools, badge: String(tools.length) },
  { id: 'integrations', label: 'Installers', icon: IconCommand, badge: String(listIntegrationRecipes().length) },
  { id: 'activity', label: 'Activity', icon: IconActivity },
  { id: 'diagnostics', label: 'Diagnostics', icon: IconInfo },
];

const TITLES: Record<View, { title: string; crumb: string }> = {
  dashboard: { title: 'Overview', crumb: 'Live operations' },
  agents: { title: 'Agents', crumb: 'All running and idle agents' },
  teams: { title: 'Teams', crumb: 'Coordinated agent squads' },
  workflows: { title: 'Workflows', crumb: 'Pipelines and graphs' },
  tools: { title: 'Tools', crumb: 'Connected providers' },
  integrations: { title: 'Installers', crumb: 'Guided agent runtime setup' },
  activity: { title: 'Activity', crumb: 'Real-time event stream' },
  diagnostics: { title: 'Diagnostics', crumb: 'Desktop readiness checks' },
};

export default function App() {
  const [view, setView] = useState<View>('dashboard');

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} />
      <div className="main">
        <TopBar view={view} />
        <div className="view">
          {view === 'dashboard' && <DashboardView />}
          {view === 'agents' && <AgentsView />}
          {view === 'teams' && <TeamsView />}
          {view === 'workflows' && <WorkflowsView />}
          {view === 'tools' && <ToolsView />}
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
        <span className="avatar">BT</span>
        <span className="meta">
          <strong>Brad Towers</strong>
          <span>Workspace owner</span>
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

function DashboardView() {
  const recentAgents = agents.slice(0, 6);
  const onlineCount = tools.filter((t) => t.status === 'connected').length;
  return (
    <>
      <section className="stats-row">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </section>

      <section>
        <div className="section-head">
          <h2>Connected tools</h2>
          <span className="hint">
            {onlineCount} online · {tools.length} total
          </span>
          <span className="right">
            <button className="btn-ghost">Manage integrations</button>
          </span>
        </div>
        <div className="tools-strip">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

      <section className="split">
        <div>
          <div className="section-head">
            <h2>Active agents</h2>
            <span className="hint">
              {recentAgents.length} of {agents.length}
            </span>
            <span className="right">
              <button className="btn-ghost">View all</button>
            </span>
          </div>
          <div className="agents-grid">
            {recentAgents.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        </div>

        <div>
          <div className="section-head">
            <h2>Live activity</h2>
            <span className="right">
              <span className="chip green">
                <span className="dot green" /> streaming
              </span>
            </span>
          </div>
          <div className="card activity">
            <ActivityList items={activity.slice(0, 8)} />
          </div>
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------- StatCard */

function StatCard({ stat }: { stat: Stat }) {
  const Trend = stat.trend === 'down' ? IconArrowDown : IconArrowUp;
  return (
    <div className="card stat-card">
      <span className="label">{stat.label}</span>
      <span className="value">{stat.value}</span>
      <span className={`change ${stat.trend}`}>
        {stat.trend !== 'flat' && <Trend width={10} height={10} />}
        {stat.change}
      </span>
      <Sparkline points={stat.spark} trend={stat.trend} />
    </div>
  );
}

function Sparkline({ points, trend }: { points: number[]; trend: 'up' | 'down' | 'flat' }) {
  const w = 88;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * (h - 2) - 1;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  // Single neutral palette — colour comes from the change pill, not the spark.
  const stroke =
    trend === 'up'
      ? 'rgba(34, 197, 94, 0.85)'
      : trend === 'down'
        ? 'rgba(255, 255, 255, 0.45)'
        : 'rgba(255, 255, 255, 0.30)';
  const fill =
    trend === 'up'
      ? 'rgba(34, 197, 94, 0.10)'
      : 'rgba(255, 255, 255, 0.04)';
  const area = `${path} L${w} ${h} L0 ${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={area} fill={fill} stroke="none" />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------- Tool cards */

/** Restrained tinted glyph — desaturated tool hue on a dark surface. */
function toolGlyphStyle(id: ToolId) {
  const meta = toolMeta[id];
  const hue = meta?.hue ?? 240;
  return {
    background: `hsl(${hue}, 14%, 14%)`,
    color: `hsl(${hue}, 30%, 78%)`,
    boxShadow: `inset 0 0 0 1px hsl(${hue}, 18%, 24%)`,
  };
}

function statusChip(status: ToolStatus) {
  switch (status) {
    case 'connected':
      return (
        <span className="chip green">
          <span className="dot green" /> Connected
        </span>
      );
    case 'degraded':
      return (
        <span className="chip amber">
          <span className="dot amber" /> Degraded
        </span>
      );
    case 'disconnected':
      return (
        <span className="chip red">
          <span className="dot red" /> Offline
        </span>
      );
    case 'pending':
      return (
        <span className="chip">
          <span className="dot" /> Pending
        </span>
      );
  }
}

function ToolCard({ tool }: { tool: Tool }) {
  const meta = toolMeta[tool.id];
  return (
    <div className="tool-card">
      <div className="head">
        <span className="tool-glyph" style={toolGlyphStyle(tool.id)}>
          {meta?.short ?? '??'}
        </span>
        <div>
          <div className="title">{tool.name}</div>
          <div className="cat">{tool.category}</div>
        </div>
      </div>
      <div className="body">{tool.description}</div>
      <div className="row">
        <span>{statusChip(tool.status)}</span>
        <span className="num">
          {tool.agentsRunning} agent{tool.agentsRunning === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Agent cards */

/** Restrained agent avatar — desaturated solid based on a deterministic hue. */
function avatarStyle(id: string) {
  const seed = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = (seed * 47) % 360;
  return {
    background: `hsl(${hue}, 14%, 18%)`,
    boxShadow: `inset 0 0 0 1px hsl(${hue}, 22%, 30%)`,
    color: `hsl(${hue}, 25%, 82%)`,
  };
}

function statusDot(status: AgentStatus) {
  switch (status) {
    case 'active':
      return <span className="dot green" title="Active" />;
    case 'idle':
      return <span className="dot" title="Idle" />;
    case 'paused':
      return <span className="dot amber" title="Paused" />;
    case 'error':
      return <span className="dot red" title="Error" />;
  }
}

function statusChipForAgent(status: AgentStatus) {
  switch (status) {
    case 'active':
      return (
        <span className="chip green">
          <span className="dot green" /> Active
        </span>
      );
    case 'idle':
      return (
        <span className="chip">
          <span className="dot" /> Idle
        </span>
      );
    case 'paused':
      return (
        <span className="chip amber">
          <span className="dot amber" /> Paused
        </span>
      );
    case 'error':
      return (
        <span className="chip red">
          <span className="dot red" /> Error
        </span>
      );
  }
}

function AgentCard({ agent }: { agent: Agent }) {
  const tool = tools.find((t) => t.id === agent.tool);
  const successPct = Math.round(agent.successRate * 100);
  const progressClass =
    agent.status === 'error'
      ? 'progress red'
      : successPct >= 95
        ? 'progress green'
        : successPct >= 85
          ? 'progress'
          : 'progress';
  return (
    <div className="card agent-card">
      <div className="head">
        <span className="agent-avatar" style={avatarStyle(agent.id)}>
          {agent.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="name-line">
          <strong>{agent.name}</strong>
          <span className="role">{agent.role}</span>
        </div>
        <span className="status">{statusChipForAgent(agent.status)}</span>
      </div>

      <div className="meta-row">
        <div>
          <div className="k">Tool</div>
          <div className="v">{tool?.name ?? agent.tool}</div>
        </div>
        <div>
          <div className="k">Model</div>
          <div className="v">{agent.model}</div>
        </div>
        <div>
          <div className="k">Tasks</div>
          <div className="v num">{agent.tasksCompleted}</div>
        </div>
        <div>
          <div className="k">Cost today</div>
          <div className="v num">${agent.costToday.toFixed(2)}</div>
        </div>
      </div>

      <div>
        <div className="progress-row">
          <span>Success</span>
          <span className="v num">{successPct}%</span>
        </div>
        <div className={progressClass}>
          <span style={{ width: `${successPct}%` }} />
        </div>
      </div>

      <div className="tags">
        {agent.tags.map((tag) => (
          <span key={tag} className="chip">
            {tag}
          </span>
        ))}
      </div>

      <div className="foot">
        {statusDot(agent.status)}
        <span>{agent.lastActivity}</span>
        <span className="num-tokens">{(agent.tokens / 1000).toFixed(0)}k tokens</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Agents view */

const AGENT_FILTERS: { id: AgentStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'idle', label: 'Idle' },
  { id: 'paused', label: 'Paused' },
  { id: 'error', label: 'Error' },
];

function AgentsView() {
  const [filter, setFilter] = useState<AgentStatus | 'all'>('all');
  const filtered = useMemo(
    () => (filter === 'all' ? agents : agents.filter((a) => a.status === filter)),
    [filter],
  );
  return (
    <>
      <div className="toolbar">
        {AGENT_FILTERS.map((f) => {
          const count = f.id === 'all' ? agents.length : agents.filter((a) => a.status === f.id).length;
          return (
            <button
              key={f.id}
              className={`filter-pill ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label} · {count}
            </button>
          );
        })}
        <span style={{ marginLeft: 'auto' }}>
          <button className="btn-ghost primary">
            <IconPlus width={12} height={12} /> Spawn agent
          </button>
        </span>
      </div>

      <div className="agents-grid">
        {filtered.map((a) => (
          <AgentCard key={a.id} agent={a} />
        ))}
        {filtered.length === 0 && <div className="empty">No agents match this filter.</div>}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- Teams view */

function TeamsView() {
  return (
    <div className="teams-grid">
      {teams.map((team) => (
        <TeamCard key={team.id} team={team} />
      ))}
      <button className="team-builder-add">
        <IconPlus />
        <span className="label">Compose new team</span>
        <span className="sub">Drag agents into a workflow</span>
      </button>
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const members = team.agentIds
    .map((id) => agents.find((a) => a.id === id))
    .filter(Boolean) as Agent[];
  const visible = members.slice(0, 4);
  const extra = members.length - visible.length;
  const steps = team.workflow.split('→').map((s) => s.trim());
  const chip =
    team.status === 'running' ? (
      <span className="chip green">
        <span className="dot green" /> Running
      </span>
    ) : team.status === 'paused' ? (
      <span className="chip amber">
        <span className="dot amber" /> Paused
      </span>
    ) : (
      <span className="chip indigo">
        <span className="dot indigo" /> Planning
      </span>
    );

  return (
    <div className="card team-card" style={{ ['--team-color' as string]: team.color }}>
      <div className="team-head">
        <h3>{team.name}</h3>
        <span style={{ marginLeft: 'auto' }}>{chip}</span>
      </div>
      <p className="desc">{team.description}</p>

      <div className="members">
        {visible.map((m) => (
          <span key={m.id} className="agent-avatar" style={avatarStyle(m.id)}>
            {m.name.slice(0, 2).toUpperCase()}
          </span>
        ))}
        {extra > 0 && <span className="extra">+{extra}</span>}
      </div>

      <div className="workflow-flow">
        {steps.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <span className="step">{s}</span>
            {i < steps.length - 1 && <span className="arrow">→</span>}
          </span>
        ))}
      </div>

      <div className="foot-row">
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {members.length} agent{members.length === 1 ? '' : 's'}
        </span>
        <span className="actions">
          <button className="btn-ghost">
            {team.status === 'running' ? <IconPause width={11} height={11} /> : <IconPlay width={11} height={11} />}
            {team.status === 'running' ? 'Pause' : 'Run'}
          </button>
          <button className="btn-ghost primary">Open</button>
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Workflow view */

function WorkflowsView() {
  return (
    <div className="canvas-wrap workflow-view">
      <div className="canvas-bg" />
      <div className="canvas-head">
        <h3>{workflow.name}</h3>
        <span className="chip green">
          <span className="dot green" /> Live
        </span>
        <span className="canvas-meta num">
          {workflow.nodes.length} nodes · {workflow.edges.length} edges
        </span>
        <span className="right">
          <button className="btn-ghost">
            <IconPause width={11} height={11} /> Pause
          </button>
          <button className="btn-ghost primary">
            <IconPlay width={11} height={11} /> Run again
          </button>
        </span>
      </div>
      <div className="canvas-scroll">
        <WorkflowCanvas wf={workflow} />
      </div>
    </div>
  );
}

function WorkflowCanvas({ wf }: { wf: Workflow }) {
  const NODE_W = 168;
  const NODE_H = 60;
  const PAD = 36;
  const width = Math.max(...wf.nodes.map((n) => n.x)) + NODE_W + PAD * 2;
  const height = Math.max(...wf.nodes.map((n) => n.y)) + NODE_H + PAD * 2;

  const nodeById = (id: string) => wf.nodes.find((n) => n.id === id)!;

  const edgePath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const sx = from.x + NODE_W + PAD;
    const sy = from.y + NODE_H / 2 + PAD;
    const ex = to.x + PAD;
    const ey = to.y + NODE_H / 2 + PAD;
    const mx = (sx + ex) / 2;
    return `M${sx} ${sy} C${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
  };

  const subFor = (kind: string) => {
    switch (kind) {
      case 'trigger':
        return 'TRIGGER';
      case 'agent':
        return 'AGENT';
      case 'gate':
        return 'GATE';
      case 'output':
        return 'OUTPUT';
      default:
        return '';
    }
  };

  return (
    <svg className="canvas-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="rgba(255, 255, 255, 0.45)" />
        </marker>
      </defs>

      {wf.edges.map((e, i) => {
        const f = nodeById(e.from);
        const t = nodeById(e.to);
        const d = edgePath(f, t);
        const lx = (f.x + NODE_W + PAD + t.x + PAD) / 2;
        const ly = (f.y + NODE_H / 2 + PAD + t.y + NODE_H / 2 + PAD) / 2 - 6;
        return (
          <g key={i}>
            <path d={d} className="canvas-edge" markerEnd="url(#arrow)" />
            {e.label && (
              <g>
                <rect
                  x={lx - 22}
                  y={ly - 9}
                  width={44}
                  height={16}
                  rx={4}
                  fill="var(--surface-2)"
                  stroke="var(--border-strong)"
                />
                <text x={lx} y={ly + 2} textAnchor="middle" className="canvas-edge-label">
                  {e.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {wf.nodes.map((n) => {
        const x = n.x + PAD;
        const y = n.y + PAD;
        const agent = n.agentId ? agents.find((a) => a.id === n.agentId) : undefined;
        const isLive = agent?.status === 'active';
        return (
          <g key={n.id} className={`canvas-node-${n.kind}`}>
            <rect className="canvas-node" x={x} y={y} width={NODE_W} height={NODE_H} rx={8} />
            <text x={x + 14} y={y + 22} className="canvas-node-sub">
              {subFor(n.kind)}
            </text>
            <text x={x + 14} y={y + 42} className="canvas-node-label">
              {n.label}
            </text>
            {isLive && <circle cx={x + NODE_W - 12} cy={y + 12} r={3.5} className="canvas-node-pulse" />}
          </g>
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------------------- Tools view */

function ToolsView() {
  return (
    <div className="tool-grid-large">
      {tools.map((tool) => (
        <ToolCardLarge key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

function ToolCardLarge({ tool }: { tool: Tool }) {
  const meta = toolMeta[tool.id];
  return (
    <div className="card tool-card-lg">
      <div className="head">
        <span className="tool-glyph" style={toolGlyphStyle(tool.id)}>
          {meta?.short ?? '??'}
        </span>
        <div>
          <h3>{tool.name}</h3>
          <span className="cat">{tool.category}</span>
        </div>
        <span style={{ marginLeft: 'auto' }}>{statusChip(tool.status)}</span>
      </div>
      <div className="body">{tool.description}</div>
      <div className="stats">
        <div>
          <div className="k">Latency</div>
          <div className="v num">{tool.latencyMs ? `${tool.latencyMs} ms` : '—'}</div>
        </div>
        <div>
          <div className="k">Agents running</div>
          <div className="v num">{tool.agentsRunning}</div>
        </div>
      </div>
      <div className="actions">
        <button className="btn-ghost">Configure</button>
        {tool.status === 'connected' ? (
          <button className="btn-ghost primary">Open</button>
        ) : (
          <button className="btn-ghost primary">Reconnect</button>
        )}
      </div>
    </div>
  );
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

  useEffect(() => {
    if (window.conductor?.integrations) {
      selectRecipe(recipes.find((recipe) => recipe.id === selectedId) ?? recipes[0]);
    }
  }, []);

  const selectRecipe = async (recipe: IntegrationRecipe) => {
    setSelectedId(recipe.id);
    setError(null);
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
            <span className="chip chip-muted">Dry run</span>
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
              This is intentionally a dry-run installer. The next slice will add a privileged approval flow before
              Conductor executes any install command on the user's machine.
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

          <div className="actions">
            <button className="btn-ghost primary" onClick={() => selectRecipe(selected)}>Refresh preview</button>
            <button className="btn-ghost" onClick={() => window.open(selected.docsUrl, '_blank', 'noopener,noreferrer')}>Open docs</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Diagnostics view */

type PrerequisiteStatus = {
  available: boolean;
  version: string | null;
  error?: string;
};

type SystemInfo = {
  appVersion: string;
  platform: string;
  arch: string;
  osRelease: string;
  hostname: string;
  homeDir: string;
};

function DiagnosticsView() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [checks, setChecks] = useState<Record<string, PrerequisiteStatus> | null>(null);
  const [loading, setLoading] = useState(false);
  const desktopAvailable = Boolean(window.conductor);

  const runChecks = async () => {
    if (!window.conductor) return;
    setLoading(true);
    try {
      const [info, prerequisites] = await Promise.all([
        window.conductor.system.getInfo(),
        window.conductor.system.checkPrerequisites(),
      ]);
      setSystemInfo(info);
      setChecks(prerequisites);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runChecks();
  }, []);

  if (!desktopAvailable) {
    return (
      <div className="diagnostics-grid">
        <div className="card diagnostic-hero">
          <span className="eyebrow">Desktop foundation</span>
          <h2>Electron shell not active</h2>
          <p>
            This web deployment is still useful for design review. The desktop build exposes local diagnostics,
            prerequisite checks, and eventually install controls through the secure Electron bridge.
          </p>
          <div className="actions">
            <button className="btn-ghost primary">Run as desktop app</button>
            <span className="hint">Use npm run desktop:dev locally.</span>
          </div>
        </div>
      </div>
    );
  }

  const entries = Object.entries(checks ?? {});
  const availableCount = entries.filter(([, check]) => check.available).length;

  return (
    <div className="diagnostics-grid">
      <div className="card diagnostic-hero">
        <span className="eyebrow">Desktop foundation</span>
        <h2>Local system diagnostics</h2>
        <p>
          Conductor can now query the local machine through a narrow Electron IPC bridge. This is the first
          building block for guided installs, provider setup, health checks, and agent runtime management.
        </p>
        <div className="actions">
          <button className="btn-ghost primary" onClick={runChecks} disabled={loading}>
            {loading ? 'Checking…' : 'Refresh checks'}
          </button>
          <span className="hint">{checks ? `${availableCount} of ${entries.length} tools found` : 'Awaiting checks'}</span>
        </div>
      </div>

      {systemInfo && (
        <div className="card diagnostic-panel">
          <div className="section-head compact">
            <h2>Machine</h2>
            <span className="hint">Conductor {systemInfo.appVersion}</span>
          </div>
          <div className="kv-grid">
            <div><span>Platform</span><strong>{systemInfo.platform}</strong></div>
            <div><span>Architecture</span><strong>{systemInfo.arch}</strong></div>
            <div><span>OS release</span><strong>{systemInfo.osRelease}</strong></div>
            <div><span>Hostname</span><strong>{systemInfo.hostname}</strong></div>
            <div className="wide"><span>Home directory</span><strong>{systemInfo.homeDir}</strong></div>
          </div>
        </div>
      )}

      <div className="card diagnostic-panel wide-panel">
        <div className="section-head compact">
          <h2>Agent tooling prerequisites</h2>
          <span className="hint">Install readiness</span>
        </div>
        <div className="check-list">
          {entries.map(([name, check]) => (
            <div className="check-row" key={name}>
              <span className={`status-dot ${check.available ? 'ok' : 'missing'}`} />
              <div>
                <strong>{name}</strong>
                <span>{check.available ? check.version : check.error ?? 'not found'}</span>
              </div>
              <span className={`chip ${check.available ? 'chip-ok' : 'chip-muted'}`}>
                {check.available ? 'Available' : 'Missing'}
              </span>
            </div>
          ))}
          {!entries.length && <p className="empty-state">Run the desktop app to collect prerequisite status.</p>}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Activity view */

function ActivityView() {
  return (
    <div className="card activity activity-view-card">
      <ActivityList items={activity} />
    </div>
  );
}

function ActivityList({ items }: { items: ActivityEvent[] }) {
  return (
    <ul className="activity-list">
      {items.map((e) => (
        <li key={e.id} className="activity-item">
          <span className={`ico ${e.level}`}>
            {e.level === 'success' && <IconCheck />}
            {e.level === 'info' && <IconInfo />}
            {e.level === 'warn' && <IconAlert />}
            {e.level === 'error' && <IconCross />}
          </span>
          <div>
            <span className="who">{e.agentName ?? 'System'}</span>
            <span className="when">{e.timestamp}</span>
            <p>{e.message}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
