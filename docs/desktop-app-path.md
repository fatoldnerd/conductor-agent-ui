# Desktop App Path

## Recommendation

Build the web app first, then wrap the production build with Tauri.

Tauri is the right default for Conductor because it gives us a real desktop shell without carrying a full Chromium runtime. It is lighter than Electron, easier to ship as a polished utility app, and fits the product: a local control plane for agent processes, terminals, configs, and workspace state.

## What we need for a real desktop app

### 1. Productize the web UI

Current app state:

- React + Vite frontend
- Mock data
- Static dashboard views
- No persistent backend
- No local process control yet

Needed:

- Replace mock data with a real local API
- Persist agents, teams, workflows, runs, settings, and audit logs
- Add authentication/lock screen for local or LAN access
- Add error states, empty states, loading states, and onboarding
- Decide which agent runtimes are first-class: Hermes, OpenClaw, Claude Code, Codex, OpenCode

### 2. Add a local control backend

The desktop app needs a trusted local backend that can:

- Start and stop agent processes
- Read and write config files safely
- Tail logs
- Open terminals or managed PTYs
- Track running jobs and costs
- Store run history
- Connect to Hermes Gateway / API server

Options:

- Tauri commands in Rust for process control and secure filesystem access
- A local Node or Python companion service for richer integration
- Direct HTTP integration to Hermes Agent API server where available

Recommended split:

- Tauri shell handles OS integration, secure file dialogs, notifications, and app lifecycle
- Hermes Agent API handles Hermes sessions, tools, memory, and skills
- A small local companion handles non-Hermes runners such as Claude Code, Codex, OpenClaw, and shell commands

### 3. Package with Tauri

Install Tauri:

```bash
npm install -D @tauri-apps/cli
npm install @tauri-apps/api
npm run tauri init
```

Then configure Tauri to use the Vite build:

```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173"
  }
}
```

Run in development:

```bash
npm run tauri dev
```

Build installers:

```bash
npm run tauri build
```

### 4. Desktop capabilities to add

Minimum useful desktop feature set:

- Native app window with tray/menu actions
- Local project picker
- Managed agent launcher
- Terminal panes backed by local PTY
- Notifications when runs complete or block
- Secure credential storage through OS keychain
- Auto-update channel
- Import/export workspace config

### 5. Distribution

For Brad's own use first:

- macOS build locally on the Mac
- unsigned internal build is acceptable for testing
- later sign and notarize if distributing publicly

For cross-platform public release:

- macOS: sign + notarize
- Windows: code-sign MSI/NSIS installer
- Linux: AppImage/deb/rpm
- GitHub Releases or an update server for auto-updates

## Electron alternative

Electron is still a good option if we need mature desktop web APIs quickly:

Pros:

- Large ecosystem
- Mature auto-update tooling
- Easier PTY integrations through Node packages
- Faster for complex desktop features

Cons:

- Much larger install size
- Higher memory use
- Feels less native
- More security surface area

Use Electron if the app becomes terminal-heavy and Node-native integrations dominate. Use Tauri if the app remains a polished control plane with selective backend commands.

## Practical next build sequence

1. Keep Conductor as a Vite web app until the UX is solid.
2. Add a real local API contract for agents, teams, runs, logs, and tools.
3. Connect Hermes Agent API server first.
4. Add managed process control for Claude Code and Codex.
5. Add persistence with SQLite.
6. Wrap with Tauri.
7. Add OS keychain, notifications, auto-update, and packaging.

## Near-term engineering tasks

- Define `AgentRuntime`, `AgentProcess`, `Team`, `Run`, and `Workflow` API models.
- Add a backend service endpoint layer rather than binding UI directly to shell commands.
- Add a local SQLite database for run history and settings.
- Add Tauri only after the browser UI is stable enough to use daily.
- Keep the Vercel web deployment as the demo/marketing surface, but treat the desktop app as the real operations console.
