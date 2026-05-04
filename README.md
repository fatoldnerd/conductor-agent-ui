# Conductor

Conductor is a desktop-first command center for managing AI agent runtimes, agent teams, and orchestration workflows across tools such as Hermes, OpenClaw, Claude Code, Codex, and future agent runtimes.

The hosted web build remains a safe preview surface. Local inventory, runtime detection, and installer execution require the Electron desktop bridge.

## What it shows

- Agent Runtimes page for local CLIs, prerequisites, deployment tools, and running services
- Agent cards for Hermes, OpenClaw, Claude Code, Codex, and specialist tools
- Team builder view for grouping agents into coordinated squads
- Workflow canvas showing orchestration pipelines
- Safe install/configure/health affordances backed by trusted recipe previews
- Activity feed for agent events, handoffs, approvals, and deployments
- Responsive dark interface suitable for web preview and desktop packaging

## Runtime safety

The renderer never accepts arbitrary shell commands. Agent Runtime actions show previews, docs, configuration steps, or desktop-bridge requirements. Command execution is limited to explicit Electron main-process installer recipes with native approval.

## Tech stack

- React
- TypeScript
- Vite
- CSS modules via plain CSS imports
- Mock data only

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Deployment

The app is Vercel-ready. The production build emits static assets to `dist/`.

## Roadmap ideas

- Real agent registry backed by Hermes/OpenClaw APIs
- Agent health checks and command execution permissions
- Team templates for engineering, research, sales engineering, and ops workflows
- Secure credential vault integration
- Live terminal panes for Claude Code and Codex sessions
- Workflow execution history and replay
- Desktop shell using Tauri or Electron
