# Conductor Build Plan

This file is the repo-local implementation plan for Conductor. It exists so Codex, Cursor, GitHub, and the app repository all have the same working roadmap.

Obsidian remains Brad/Hermes' strategic notebook and collaboration log. This file is the implementation-facing source of truth inside the repo.

## Product thesis

Conductor is a desktop-first Electron control plane for local AI agent operations.

It is not a web dashboard pretending to know local machine state. It is a local cockpit for discovering, configuring, launching, supervising, and eventually orchestrating AI agent runtimes and agent teams.

Conductor should support two layers:

1. Mission layer
   - For non-technical users.
   - Helps users describe what they want done.
   - Provides templates, guided next actions, approval gates, deliverable review, and plain-English status.

2. Operator layer
   - For technical users and developers.
   - Shows local runtimes, tools, services, ports, health, logs, readiness, and safe operational actions.
   - Allows inspection without hiding important technical truth.

The long-term direction is a Dual-Layer Cockpit: mission-first by default, with operator depth one layer deeper.

## Non-negotiable truthfulness rules

Conductor must be trusted before it is powerful.

Rules:

- Do not show fake missions.
- Do not show fake agents.
- Do not show fake runs.
- Do not show fake approvals.
- Do not show fake deliverables.
- Do not show fake activity.
- Do not show fake connected tools.
- Do not imply a runtime is installed, ready, or running unless local evidence supports it.
- Browser mode must show desktop-required empty states.
- Desktop mode must use sanitized Electron inventory from the local machine.
- `inventory === null` must not mean available or ready.
- `not_scanned` must remain distinct from `missing`.
- SSH tunnels and generic port conflicts must not be reported as local Hermes or OpenClaw services.
- Do not hardcode Brad-specific Hugo or Kestrel instances.
- Renderer code must not execute arbitrary shell commands.
- Safe action metadata should remain preview-only unless backed by explicit allowlisted Electron APIs.
- Never leak secrets, credential paths, private tunnel targets, SSH command args, hostnames, or tokens in UI summaries.

## Desktop-first architecture decisions

Conductor is Electron-first.

Why:

- Local runtime detection requires access to the user's machine.
- CLI discovery requires local PATH and process checks.
- Service health requires local port and process inspection.
- Safe launch, repair, install, and supervision actions need controlled native access.
- Browser-only mode cannot truthfully inspect local runtimes.

Architecture boundaries:

- Electron main/preload owns local system access.
- Renderer displays sanitized inventory and action metadata.
- Renderer must not run arbitrary shell commands.
- Local system APIs should be allowlisted, auditable, and test-covered.
- Browser mode should degrade honestly into desktop-required empty states.

Development delivery:

- GitHub repository is the source of code truth.
- GitHub Actions is the desktop build factory.
- Vercel is not part of desktop app delivery.
- Artifact install testing should happen at meaningful milestones, not after every small commit.

Local development:

- Brad's local Mac repo path: `/Users/bradtowers/Documents/App Projects/conductor-agent-ui`.
- Desktop dev should use dedicated Vite port `5273` with strict port behavior.
- Current dev script uses Electron against `http://127.0.0.1:5273`.

## Current completed milestones

### Desktop workflow and build pipeline

- Local repo workflow established for Codex/Cursor development.
- Desktop dev port moved from Vite default `5173` to dedicated `5273` with strict port behavior.
- GitHub Actions macOS desktop build pipeline confirmed.
- Current desktop artifact flow is via GitHub Actions, not Vercel.

Key commit:

- `c5747b0 fix: use dedicated desktop dev port`

### Product direction

- Product vision defined as a desktop agent-ops cockpit.
- Structured build plan created in Obsidian.
- UI/UX direction documented as Dual-Layer Cockpit.
- Visual redesign implementation is parked until a stronger design direction exists.

Key commit:

- `a8529bc docs: define dual-layer cockpit UI direction`

### Fake operational data cleanup

- Removed fake Agents, Teams, Workflows, and Activity operational views.
- Deleted production mock operational data usage.
- Added regression tests to prevent mock operational data from returning.

Key commit:

- `498720b fix: remove fake operational views`

### Runtime truthfulness

- `inventory === null` no longer means runtime available.
- Unknown and not-scanned states are distinct from missing.
- Browser Agent Runtimes view is desktop-required and does not imply local runtime state.
- Inventory view states distinguish bridge unavailable, loading, error, not scanned, no tools detected, config-needed, partial inventory, and ready/current.

Key commits:

- `334c794 fix: make runtime availability truthful`
- `9ce3a69 feat: clarify inventory screen states`

### Canonical runtime readiness model

Canonical runtime IDs:

- `claude-code`
- `codex-cli`
- `gemini-cli`
- `hermes`
- `openclaw`

Readiness states include:

- `ready`
- `installed`
- `running`
- `missing`
- `needs_config`
- `needs_credentials`
- `broken`
- `unsupported`
- `not_scanned`
- `stopped`

Runtime categories include:

- agent runtime
- prerequisite
- deployment tool
- service

Safe action metadata exists but must remain preview-only unless backed by allowlisted Electron APIs.

Key commit:

- `22e6996 feat: define truthful runtime readiness model`

### Hermes and OpenClaw service truthfulness

- Port presence alone no longer means Hermes or OpenClaw is running.
- SSH-owned local forwards are identified as `port_in_use` / `ssh_tunnel`.
- SSH tunnel details are sanitized.
- Hermes dashboard/API ports must not be reported as local services when they are local SSH forwards to remote infrastructure.

### Runtime detail cards and panels

- Runtime/tool/service cards now show truthful readiness labels, diagnosis, version, sanitized helper text, safe primary action metadata, and docs/config/credential hints.
- Dashboard counts canonical `ready` state correctly for Claude Code, Codex CLI, and Gemini CLI.
- Runtime-specific detail panels exist for Claude Code, Codex CLI, Gemini CLI, Hermes, and OpenClaw.
- Panels use canonical readiness and sanitized Electron inventory.
- No fake runtime state was added.

Key commits:

- `b0db612 feat: improve runtime detail cards`
- `283320e feat: add runtime-specific detail panels`

## Current state / latest checkpoint

Latest confirmed checkpoint:

- Commit: `b388e95 merge: runtime action handler registry contract`
- Feature commit: `51b7620 feat: add runtime action handler registry contract`
- GitHub Actions: Desktop macOS Build passed
- Latest verified Actions run: `25458687751`
- Local validation: `npm test -- --run` passed with 50 test files and 184 tests; `npm run build` passed
- Status: clean safety-foundation checkpoint before real allowlisted execution handlers

Current app behavior:

- Desktop mode reflects sanitized Electron inventory.
- Browser mode shows desktop-required empty states.
- Claude Code, Codex CLI, and Gemini CLI can show ready states when installed locally.
- Hermes and OpenClaw are modeled as canonical runtimes/services, but must not be hardcoded to Brad's Mac Mini instances.
- Hermes API/dashboard ports that are SSH tunnels or generic conflicts remain truthful as port conflict states, not local running service states.
- Runtime action audit history, approval queue, approval decisions, native confirmation history, native confirmation projection, and approval controls are modeled and test-covered.
- Future execution planning and allowlisted handler registry contracts exist.
- No real runtime action execution handlers, generic execute IPC channels, or renderer-controlled shell execution exist yet.

Known local inventory facts from Brad's Mac during prior smoke testing:

- Platform: macOS / darwin.
- Claude Code was detected as ready with version `2.1.126 (Claude Code)`.
- Codex CLI was detected as ready with version `codex-cli 0.125.0`.
- Gemini CLI was detected as ready with version `0.1.7`.
- Hermes CLI was missing locally.
- OpenClaw was missing or stopped locally.
- Ports `8642` and `9119` may be owned by SSH local forwards and must not imply local Hermes is running.

## Active phase

Current phase: deepen truthful local runtime management before adding mission orchestration.

The app should continue building reliable local-runtime foundations:

- robust runtime detection
- explicit readiness states
- truthful service detection
- safe action previews
- sanitized diagnostics
- clear browser vs desktop behavior
- test coverage for every truthfulness rule

Do not start the visual redesign yet.

Do not start fake mission orchestration.

## Immediate next implementation slices

### Slice 1: Repository-local build plan

Status: current file.

Goal:

- Put the working roadmap in the repo so Codex/Cursor can use it directly.

Expected output:

- `docs/CONDUCTOR_BUILD_PLAN.md`

### Slice 2: Runtime diagnostics polish

Goal:

- Improve diagnostics for installed, missing, broken, stopped, not-scanned, and needs-config runtime states.

Constraints:

- Use canonical runtime readiness model.
- Keep all diagnostics sanitized.
- Do not expose raw command stderr if it contains private paths, shell state, tokens, tunnel details, or hostnames.
- Avoid claiming repair/install ability until safe allowlisted actions exist.

Possible work:

- Improve `pnpm` Corepack failure handling so broken tool state is not reported as simply missing.
- Add sanitized failure summaries for broken CLI checks.
- Add tests for broken CLI output classification.

### Slice 3: Runtime action preview model

Goal:

- Make preview-only actions clearer before implementing execution.

Constraints:

- Renderer must not execute arbitrary commands.
- Actions should show what would happen, not claim the app can already do it.
- Any future execution must be backed by allowlisted Electron APIs.

Possible work:

- Standardize safe action metadata shape.
- Add explicit `previewOnly: true` or equivalent if not already present.
- Show action requirements and risk level.
- Add tests that browser mode cannot execute actions.

### Slice 4: Desktop smoke and artifact milestone

Goal:

- At the next meaningful milestone, test the latest GitHub Actions artifact locally.

Do not test every artifact after every small commit.

Test when:

- runtime diagnostics are improved, or
- action preview model is clearer, or
- a larger UI/IA slice lands.

### Slice 5: Mission Control shell, later

Goal:

- Add mission-first IA shell without fake data.

Not now unless explicitly chosen.

Allowed future shape:

- Mission Control empty state.
- New Mission composer shell.
- Approvals empty state.
- Deliverables empty state.
- Inspect technical details escape hatch.

Hard rule:

- No fake missions, fake agents, fake approvals, fake deliverables, or fake activity.

## Parked work

### Visual UI redesign

Parked.

The Dual-Layer Cockpit direction is committed, but image variants were not strong enough. Do not force a weak visual direction into the app.

Future visual direction should be:

- premium desktop cockpit
- dense but calm
- mission-first for non-technical users
- operator-depth for technical users
- inspired by Linear, Raycast, Warp, Cursor, ClawX, and AionUi, but original
- not generic SaaS dashboard
- not neon cyberpunk clutter
- not fake observability

### Multi-agent orchestration

Parked until local runtime truthfulness and safe action foundations are stronger.

Future orchestration should include:

- mission templates
- runtime/team preflight
- approval gates
- progress timeline
- deliverable review
- inspect technical details
- run history

### Installer / repair actions

Parked until action preview and allowlisted execution model are explicitly designed and tested.

### App signing, notarization, and releases

Parked until the app is worth distributing more broadly.

Future work:

- macOS signing
- notarization
- GitHub Releases
- update flow

## Testing and commit protocol

For code changes:

- Run `npm test`.
- Run `npm run build`.
- Run `npm run desktop:dev` for visual/desktop sanity when UI behavior changes.
- Use GitHub Actions as clean macOS build confirmation after push.

For documentation-only changes:

- Tests are not required unless tooling or repo policy requires them.
- Report changed files clearly.

For commits:

- Stage only intended files.
- Do not stage unrelated dirty files.
- Known unrelated dirty files may include:
  - `package-lock.json`
  - `CLAUDE.md`
  - `docs/screenshots/`
- Use conventional commits.

Example commit messages:

- `docs: add conductor build plan`
- `fix: classify broken cli diagnostics truthfully`
- `feat: add runtime action preview model`

Artifact testing:

- Do not require manual artifact install testing after every small commit.
- Test artifacts at meaningful milestones.

## Files and areas of the app that matter

Core UI:

- `src/App.tsx`
- `src/styles/index.css`

Runtime modeling:

- `src/runtimeReadiness.ts`
- `src/localTools.ts`
- `src/agentRuntimeAvailability.ts`
- `src/inventoryViewState.ts`

Electron local inventory:

- `electron/systemInventory.cjs`
- `electron/main.cjs`
- `src/electron.d.ts`

Tests:

- `src/runtimeReadiness.test.ts`
- `src/localTools.test.ts`
- `src/agentRuntimeAvailability.test.ts`
- `src/inventoryViewState.test.ts`
- `src/appNoMockData.test.ts`
- `electron/systemInventory.test.mjs`

Docs:

- `docs/ui-ux-direction.md`
- `docs/desktop-app-path.md`
- `docs/CONDUCTOR_BUILD_PLAN.md`

Build and packaging:

- `package.json`
- `.github/workflows/desktop-macos.yml`

## Codex working rules

When using Codex on this repo:

- Keep prompts tightly scoped.
- Do not let Codex touch unrelated dirty files.
- Prefer one implementation slice per prompt.
- Require changed files and validation results in Codex output.
- For UI work, require explicit truthfulness constraints.
- For runtime work, require tests.
- For documentation-only work, do not run heavy validation unless needed.

## Current next recommended Codex prompt

Use this after this file is committed and pushed:

