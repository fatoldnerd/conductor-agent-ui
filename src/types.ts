export type AgentStatus = 'active' | 'idle' | 'paused' | 'error';

export type ToolId =
  | 'openclaw'
  | 'hermes'
  | 'claude-code'
  | 'codex';

export type ToolStatus = 'connected' | 'degraded' | 'disconnected' | 'pending';

export interface Tool {
  id: ToolId;
  name: string;
  category: 'Coding' | 'Research' | 'Ops' | 'Integrations';
  status: ToolStatus;
  latencyMs: number;
  agentsRunning: number;
  description: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  tool: ToolId;
  status: AgentStatus;
  model: string;
  tasksCompleted: number;
  successRate: number;
  costToday: number;
  tokens: number;
  team?: string;
  tags: string[];
  lastActivity: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  color: string;
  agentIds: string[];
  workflow: string;
  status: 'running' | 'paused' | 'planning';
}

export interface WorkflowNode {
  id: string;
  label: string;
  agentId?: string;
  kind: 'trigger' | 'agent' | 'gate' | 'output';
  x: number;
  y: number;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ActivityEvent {
  id: string;
  agentId?: string;
  agentName?: string;
  tool?: ToolId;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
  timestamp: string;
}

export interface Stat {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'flat';
  spark: number[];
}
