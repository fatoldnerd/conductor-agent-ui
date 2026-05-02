import { useMemo, useState } from 'react';
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

type View = 'dashboard' | 'agents' | 'teams' | 'workflows' | 'tools' | 'activity';

const NAV: { id: View; label: string; icon: (p: { width?: number; height?: number }) => JSX.Element; badge?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
  { id: 'agents', label: 'Agents', icon: IconAgents, badge: String(agents.length) },
  { id: 'teams', label: 'Teams', icon: IconTeams, badge: String(teams.length) },
  { id: 'workflows', label: 'Workflows', icon: IconWorkflow },
  { id: 'tools', label: 'Tools', icon: IconTools, badge: String(tools.length) },
  { id: 'activity', label: 'Activity', icon: IconActivity },
];

const TITLES: Record<View, { title: string; crumb: string }> = {
  dashboard: { title: 'Mission Control', crumb: 'Live overview' },
  agents: { title: 'Agents', crumb: 'All running and idle agents' },
  teams: { title: 'Teams', crumb: 'Coordinated agent squads' },
  workflows: { title: 'Workflows', crumb: 'Pipelines and graphs' },
  tools: { title: 'Tools', crumb: 'Connected providers' },
  activity: { title: 'Activity', crumb: 'Real-time event stream' },
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
          {view === 'activity' && <ActivityView />}
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
          <span className="hint">{tools.filter((t) => t.status === 'connected').length} online · {tools.length} total</span>
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
            <span className="hint">Showing {recentAgents.length} of {agents.length}</span>
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
        {stat.trend !== 'flat' && <Trend width={11} height={11} />}
        {stat.change}
      </span>
      <Sparkline points={stat.spark} trend={stat.trend} />
    </div>
  );
}

function Sparkline({ points, trend }: { points: number[]; trend: 'up' | 'down' | 'flat' }) {
  const w = 86;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const stroke = trend === 'down' ? 'var(--cyan)' : trend === 'flat' ? 'var(--text-dim)' : 'var(--green)';
  const fill = trend === 'down' ? 'rgba(34,211,238,0.18)' : 'rgba(52,211,153,0.18)';
  const area = `${path} L${w} ${h} L0 ${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={area} fill={fill} stroke="none" />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------------------------------------- Tool cards */

function toolGlyphStyle(id: ToolId) {
  const meta = toolMeta[id];
  const hue = meta?.hue ?? 240;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 80% 60%), hsl(${(hue + 40) % 360} 75% 50%))`,
  };
}

function statusChip(status: ToolStatus) {
  switch (status) {
    case 'connected':
      return <span className="chip green"><span className="dot green" /> Connected</span>;
    case 'degraded':
      return <span className="chip amber"><span className="dot amber" /> Degraded</span>;
    case 'disconnected':
      return <span className="chip red"><span className="dot red" /> Offline</span>;
    case 'pending':
      return <span className="chip"><span className="dot" /> Pending</span>;
  }
}

function ToolCard({ tool }: { tool: Tool }) {
  const meta = toolMeta[tool.id];
  return (
    <div className="tool-card">
      <div className="head">
        <span className="glyph" style={toolGlyphStyle(tool.id)}>{meta?.short ?? '?'}</span>
        <div>
          <div className="title">{tool.name}</div>
          <div className="cat">{tool.category}</div>
        </div>
      </div>
      <div className="body">{tool.description}</div>
      <div className="row">
        <span className="status-line">{statusChip(tool.status)}</span>
        <span>{tool.agentsRunning} agent{tool.agentsRunning === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Agent cards */

const AGENT_AVATAR_GRADS = [
  'linear-gradient(135deg,#7c5cff,#22d3ee)',
  'linear-gradient(135deg,#f472b6,#7c5cff)',
  'linear-gradient(135deg,#22d3ee,#34d399)',
  'linear-gradient(135deg,#fb923c,#f472b6)',
  'linear-gradient(135deg,#34d399,#22d3ee)',
  'linear-gradient(135deg,#a78bfa,#22d3ee)',
];

function avatarFor(id: string) {
  const seed = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AGENT_AVATAR_GRADS[seed % AGENT_AVATAR_GRADS.length];
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
      return <span className="chip green"><span className="dot green" /> Active</span>;
    case 'idle':
      return <span className="chip"><span className="dot" /> Idle</span>;
    case 'paused':
      return <span className="chip amber"><span className="dot amber" /> Paused</span>;
    case 'error':
      return <span className="chip red"><span className="dot red" /> Error</span>;
  }
}

function AgentCard({ agent }: { agent: Agent }) {
  const tool = tools.find((t) => t.id === agent.tool);
  return (
    <div className="card agent-card">
      <div className="head">
        <span className="agent-avatar" style={{ background: avatarFor(agent.id) }}>
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
          <div className="v">{agent.tasksCompleted}</div>
        </div>
        <div>
          <div className="k">Cost today</div>
          <div className="v">${agent.costToday.toFixed(2)}</div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
          <span>Success</span>
          <span style={{ color: 'var(--text)' }}>{Math.round(agent.successRate * 100)}%</span>
        </div>
        <div className="progress">
          <span style={{ width: `${agent.successRate * 100}%` }} />
        </div>
      </div>

      <div className="tags">
        {agent.tags.map((tag) => (
          <span key={tag} className="chip">{tag}</span>
        ))}
      </div>

      <div className="foot">
        {statusDot(agent.status)}
        <span>{agent.lastActivity}</span>
        <span style={{ marginLeft: 'auto' }}>{(agent.tokens / 1000).toFixed(0)}k tokens</span>
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconPlus width={12} height={12} /> Spawn agent
            </span>
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
  const members = team.agentIds.map((id) => agents.find((a) => a.id === id)).filter(Boolean) as Agent[];
  const visible = members.slice(0, 4);
  const extra = members.length - visible.length;
  const steps = team.workflow.split('→').map((s) => s.trim());
  const statusChip = team.status === 'running'
    ? <span className="chip green"><span className="dot green" /> Running</span>
    : team.status === 'paused'
      ? <span className="chip amber"><span className="dot amber" /> Paused</span>
      : <span className="chip violet"><span className="dot violet" /> Planning</span>;

  return (
    <div className="card team-card" style={{ ['--team-color' as string]: team.color }}>
      <div className="team-head">
        <h3>{team.name}</h3>
        <span style={{ marginLeft: 'auto' }}>{statusChip}</span>
      </div>
      <p className="desc">{team.description}</p>

      <div className="members">
        {visible.map((m) => (
          <span key={m.id} className="agent-avatar" style={{ background: avatarFor(m.id) }}>
            {m.name.slice(0, 2).toUpperCase()}
          </span>
        ))}
        {extra > 0 && <span className="extra">+{extra} more</span>}
      </div>

      <div className="workflow-flow">
        {steps.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <span className="step">{s}</span>
            {i < steps.length - 1 && <span className="arrow">→</span>}
          </span>
        ))}
      </div>

      <div className="foot-row">
        <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
          {members.length} agent{members.length === 1 ? '' : 's'}
        </span>
        <span className="actions">
          <button className="btn-ghost">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {team.status === 'running' ? <IconPause width={11} height={11} /> : <IconPlay width={11} height={11} />}
              {team.status === 'running' ? 'Pause' : 'Run'}
            </span>
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
    <div className="canvas-wrap">
      <div className="canvas-bg" />
      <div className="canvas-head">
        <h3>{workflow.name}</h3>
        <span className="chip green"><span className="dot green" /> Live</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
          {workflow.nodes.length} nodes · {workflow.edges.length} edges
        </span>
        <span className="right">
          <button className="btn-ghost">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconPause width={11} height={11} /> Pause
            </span>
          </button>
          <button className="btn-ghost primary">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconPlay width={11} height={11} /> Run again
            </span>
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
  const NODE_H = 64;
  const PAD = 40;
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
      case 'trigger': return 'TRIGGER';
      case 'agent': return 'AGENT';
      case 'gate': return 'GATE';
      case 'output': return 'OUTPUT';
      default: return '';
    }
  };

  return (
    <svg className="canvas-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="rgba(124,92,255,0.7)" />
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
                <rect x={lx - 22} y={ly - 9} width={44} height={16} rx={4} fill="var(--surface-2)" stroke="var(--border)" />
                <text x={lx} y={ly + 2} textAnchor="middle" className="canvas-edge-label">{e.label}</text>
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
            <rect className="canvas-node" x={x} y={y} width={NODE_W} height={NODE_H} rx={10} />
            <text x={x + 14} y={y + 24} className="canvas-node-sub">{subFor(n.kind)}</text>
            <text x={x + 14} y={y + 44} className="canvas-node-label">{n.label}</text>
            {isLive && <circle cx={x + NODE_W - 14} cy={y + 14} r={4} className="canvas-node-pulse" />}
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
        <span className="glyph" style={toolGlyphStyle(tool.id)}>{meta?.short ?? '?'}</span>
        <div>
          <h3>{tool.name}</h3>
          <span className="cat" style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {tool.category}
          </span>
        </div>
        <span style={{ marginLeft: 'auto' }}>{statusChip(tool.status)}</span>
      </div>
      <div className="body">{tool.description}</div>
      <div className="stats">
        <div>
          <div className="k">Latency</div>
          <div className="v">{tool.latencyMs ? `${tool.latencyMs} ms` : '—'}</div>
        </div>
        <div>
          <div className="k">Agents running</div>
          <div className="v">{tool.agentsRunning}</div>
        </div>
      </div>
      <div className="actions">
        <button className="btn-ghost">Configure</button>
        {tool.status === 'connected'
          ? <button className="btn-ghost primary">Open</button>
          : <button className="btn-ghost primary">Reconnect</button>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Activity view */

function ActivityView() {
  return (
    <div className="card activity">
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
