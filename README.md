# Conductor

Conductor is a visual command center concept for managing AI agents, agent teams, and orchestration workflows across tools such as Hermes, OpenClaw, Claude Code, Codex, and future agent runtimes.

This first version is a static React prototype. It has no backend and uses mock data, which makes it safe to deploy publicly as a UI proof of concept.

## What it shows

- Mission control dashboard for active agents and runs
- Agent cards for Hermes, OpenClaw, Claude Code, Codex, and specialist tools
- Team builder view for grouping agents into coordinated squads
- Workflow canvas showing orchestration pipelines
- Tool connection status for local CLIs and cloud providers
- Activity feed for agent events, handoffs, approvals, and deployments
- Responsive dark interface suitable for web or desktop packaging later

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
