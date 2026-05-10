# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Conductor

Conductor is a desktop-first control plane for managing AI agent runtimes (Claude Code, Codex CLI, Gemini CLI, Hermes, OpenClaw). The hosted web build on Vercel is a safe preview-only surface — local inventory, runtime detection, installer execution, and agent console access require the Electron desktop app.

## Commands

```bash
npm run dev              # Vite dev server (web-only preview)
npm run build            # tsc + vite build → dist/
npm run test             # vitest run (all tests)
npm run desktop:dev      # Electron + Vite concurrently (full desktop app)
npm run desktop:build:mac  # Production macOS .dmg/.zip
npm run desktop:smoke    # CLI-only inventory collector (no UI)
```

Run a single test file:
```bash
npx vitest run src/runtimeActionAllowlist.test.ts
```

## Architecture

### Dual-environment model

The app has two runtime targets from the same source:

1. **Hosted web build** (Vercel) — static SPA preview. No shell access, no IPC. All runtime actions show previews/docs only.
2. **Electron desktop app** — full capabilities via the preload bridge (`window.conductor`).

### Layer breakdown

| Layer | Module format | Location |
|-------|--------------|----------|
| React SPA renderer | TypeScript ESM | `src/` |
| Electron main process | CommonJS | `electron/*.cjs` |
| Preload bridge | CommonJS | `electron/preload.cjs` |
| Shared type definitions | TypeScript | `src/electron.d.ts`, `src/types.ts` |

### Renderer safety model

The renderer **never** executes arbitrary shell commands. It sends structured payloads to the main process which:
- Owns command recipes and handler registries
- Requires native approval dialogs for destructive actions
- Returns typed result envelopes back to the renderer

The allowlisted desktop APIs are defined in `src/runtimeActionAllowlist.ts`. Any new runtime action must be added to this allowlist and routed through `electron/runtimeActionHandlerRegistry.cjs`.

### Single-file SPA

The entire UI lives in `src/App.tsx` — a single large component with view-state switching. There is no router or page-level code splitting.

### Recipe system

Integration recipes (`src/integrations/recipes.ts`) define declarative install/update/uninstall steps for each agent runtime. The Electron main process (`electron/installerRunner.cjs`) executes these with per-step approval and audit logging.

### Inventory system

`electron/systemInventory.cjs` collects local machine state (installed tools, running services, agent processes, config files). The renderer displays this via `src/inventoryViewState.ts` with graceful fallback when running outside Electron.

### IPC bridge contract

All renderer ↔ main communication goes through `electron/preload.cjs` which exposes `window.conductor` with namespaced APIs: `system`, `integrations`, `agents`, `runtimeActions`, `missions`.

## Testing

- Tests use Vitest. Both `.test.ts` (ESM/TypeScript) and `.test.mjs` (pure ESM) patterns are used.
- Electron main-process tests (`electron/*.test.mjs`) test CJS modules from ESM test files.
- Bridge contract tests verify the preload API shape matches what the renderer expects.
- No DOM rendering tests — the test suite focuses on logic, state derivation, and contracts.

## CI

GitHub Actions workflow (`.github/workflows/desktop-macos.yml`) runs on macOS:
- `npm test` → `npm run build` → `npm run desktop:build:mac` (unsigned)
- Triggers on pushes/PRs touching `electron/`, `src/`, or build configs.

Conductor Product Constraints
    
    Conductor is desktop-first. The Electron desktop app is the primary product surface. Browser/dev mode is useful for UI development, but it must not pretend desktop-only capabilities are available.
    
    Do not show fake/sample live data, fake mission history, synthetic activity, or non-installed tools as if they are real. Empty states are preferred over misleading data.
    
    Do not hardcode Brad-specific agent names such as Hugo or Kestrel into the product. Hugo is Brad's Mac Mini OpenClaw agent. Kestrel is Brad's wife's assistant and is out of scope for Brad/Hermes work.
    
    Dashboard and Agent Runtimes should reflect only sanitized local Electron inventory from the machine being tested. In browser mode, show desktop-required empty states instead of invented data.
    
    No generic shell runner in the UI. Runtime actions must be audited, explicit, and narrow. Avoid arbitrary renderer execution. Prefer fixed recipes and safe lifecycle actions.
    
    Mission/activity history should be backed by real persisted data, preferably Electron-main owned JSONL/audit-store patterns, not browser localStorage for production-grade history.
    
    Repo Review and Mission Control work should preserve product-readable status language: lifecycle labels, clear deliverables, review-report panels, and plain-English progress.
    
    Hermes runs on a headless VPS and cannot directly perform local Mac desktop UI testing. Desktop testing must happen on Brad's Mac, Brad's laptop, CI packaging, or via Hugo on the Mac Mini.
    
    Collaboration Model
    
    Brad may work locally with Claude Code in this repo. Hermes keeps strategic/project memory and reviews pushed branches or pasted diffs. GitHub is the sync point between local Claude Code work and Hermes review.
    
    Prefer small safe slices:
    1. inspect current behavior
    2. propose the smallest valuable change
    3. implement
    4. run targeted tests
    5. summarize files changed, tests run, and remaining risks
    
    Before changing user-visible behavior, state the intended product impact. Preserve existing behavior unless explicitly changing it.
    
    Useful Known Paths
    
    Brad's local Mac clone:
    /Users/bradtowers/Documents/App Projects/conductor-agent-ui
    
    Recommended local worktree parent:
    /Users/bradtowers/Documents/App Projects/conductor-agent-ui-worktrees/
    
    Hermes VPS clone:
    /root/conductor-agent-ui
    
    GitHub:
    https://github.com/fatoldnerd/conductor-agent-ui.git
    
    Quality Bar
    
    Run relevant tests before declaring work complete. If a full test suite is too broad, run targeted tests and state what was not run.
    
    Do not claim desktop behavior was validated unless it was actually tested in Electron on a Mac or via CI artifact.
    
    Do not create decorative AI-looking UI changes unless specifically requested. Prefer restrained, product-native UI that is useful under real operating conditions.