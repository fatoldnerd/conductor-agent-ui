# Conductor Desktop Testing

Conductor is a desktop app first. The hosted Vercel build is only a preview surface. Local diagnostics, agent discovery, installer execution, and runtime control require Electron because the browser build has no safe access to the operating system.

## Target test machine

Use a real desktop host, ideally Brad's Mac Mini or laptop.

Known Mac Mini context:

- macOS desktop host
- OpenClaw agents: Hugo and Kestrel
- Expected local gateway ports:
  - Hugo: `18789`
  - Kestrel: `18790`

Hermes currently runs on a headless VPS, so Hermes can build and validate the code but cannot visually smoke-test the Electron UI on the VPS.

## First-time setup on the Mac

Clone and install:

```bash
git clone https://github.com/fatoldnerd/conductor-agent-ui.git
cd conductor-agent-ui
npm install
```

Run the desktop app in dev mode:

```bash
npm run desktop:dev
```

Open **Diagnostics** in the sidebar.

Expected desktop signals:

- Electron shell active, not the Vercel/browser fallback.
- Desktop bridge smoke status: `Ready`.
- Machine platform: `darwin` on macOS.
- Tooling statuses for OpenClaw, Claude Code, Codex, Node, npm, pnpm, git, tmux.
- Local OpenClaw agents section shows Hugo and Kestrel.
- Hugo should show port `18789` if running.
- Kestrel should show port `18790` if running.

## CLI smoke check

This does not launch the UI. It verifies the same inventory collector that the Electron bridge calls:

```bash
npm run desktop:smoke
```

Expected shape:

```json
{
  "platform": "darwin",
  "desktopSmoke": {
    "bridgeExpected": true,
    "platformSupported": true,
    "status": "ready"
  },
  "agents": {
    "hugo": { "running": true, "port": 18789 },
    "kestrel": { "running": true, "port": 18790 }
  }
}
```

If Hugo or Kestrel are stopped, their `running` value may be `false`; that is a useful status, not necessarily a Conductor failure.

## Build a local macOS artifact

On macOS:

```bash
npm run desktop:build:mac
```

Artifacts are written to `release/`. They are intentionally ignored by Git.

Unsigned builds may trigger macOS Gatekeeper warnings. That is expected until we add signing and notarization.

## CI macOS artifact

A macOS GitHub Actions workflow template is checked in at:

```text
ci-templates/desktop-macos.yml
```

It builds an unsigned macOS artifact on a real macOS runner and uploads `release/` as an artifact. It does not publish a release and does not sign/notarize yet.

Note: the current GitHub token available to Hermes cannot push active `.github/workflows/*` files because it lacks the `workflow` scope. To activate the workflow, copy the template to `.github/workflows/desktop-macos.yml` using a GitHub token/account with workflow permission.

## Before pushing desktop changes

Run:

```bash
npm test
npm run build
node -c electron/main.cjs
node -c electron/preload.cjs
node -c electron/systemInventory.cjs
npm audit --audit-level=moderate
```

On a Mac, additionally run:

```bash
npm run desktop:smoke
npm run desktop:dev
```

## Current limitations

- Desktop UI visual testing must happen on a desktop host, not the Hermes VPS.
- macOS builds are unsigned and not notarized.
- Installer execution is intentionally allowlisted and requires native approval.
- The Vercel preview cannot run diagnostics or local control actions because it has no Electron bridge.
