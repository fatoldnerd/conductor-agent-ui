# Conductor UI/UX Direction

## Product Principles

Conductor is a desktop-first agent-ops cockpit for running, supervising, and approving local agent work. It should feel like a serious local control plane, not a web analytics dashboard. Every operational surface must be grounded in real local state, persisted run data, or explicit user-authored mission data.

- Show truthful state only. Unknown, not scanned, unavailable, forwarded, failed, or awaiting approval are first-class states.
- Make local runtime safety visible. Users should understand when Conductor is reading inventory, previewing commands, or waiting for a trusted main-process action.
- Support two entry points: command-first for operators and mission-first for non-technical users.
- Keep the interface dense but calm. Power users should scan quickly; new users should always see the next practical action.
- Progressive disclosure is mandatory. Plain-English summaries come first; logs, process IDs, health checks, and command details sit one layer deeper.
- Never use fake connected tools, fake running agents, or synthetic activity as operational UI.

## Emotional Feel

Conductor should feel focused, precise, quiet, and capable. The target is a premium desktop utility with the confidence of Linear, the command speed of Raycast, the terminal fluency of Warp, and the agent-centric workflow clarity of Cursor, ClawX, and AionUi. It should feel original: less “dashboard,” more “mission control for useful local work.”

It should not feel like:

- A SaaS landing page with oversized cards and decorative gradients.
- A fake observability dashboard full of empty metrics.
- A chat app pretending to be an operating system.
- A terminal wrapper that only technical users can understand.
- A toy agent demo where “agents” appear alive without proof.

## Audiences

### Technical Operator / Developer

Primary jobs:

- Inspect local runtime inventory.
- Configure and validate agent CLIs.
- Start read-only or approved agent runs.
- Watch logs, stdout/stderr, process state, and health checks.
- Manage local services and avoid confusing forwarded ports with real local services.
- Use a command palette to move quickly.

Technical users need dense tables, compact cards, exact readiness labels, logs, and safe action previews.

### Non-Technical Mission User

Primary jobs:

- Describe a mission in plain English.
- Pick or accept an agent team.
- Understand what will happen before it starts.
- Approve risky steps.
- Review deliverables.
- Ask for revisions without needing runtime details.

Non-technical users need templates, guided next actions, plain-English status, approval gates, deliverable review, and an “inspect technical details” escape hatch.

## Progressive Disclosure

Every screen should have three layers:

1. Summary: what is happening, whether it needs action, and what the next safe step is.
2. Operational detail: agents, runtimes, readiness, approvals, run timeline, deliverables.
3. Technical inspection: logs, command recipes, health checks, local process state, sanitized inventory, stdout/stderr.

Technical details should never be hidden from power users, but they should not be required for basic mission orchestration.

## Information Architecture

Recommended structure:

- Home / Mission Control
- New Mission
- Agent Teams
- Runs / Work Timeline
- Agent Runtimes
- Agent Console
- Approvals
- Deliverables
- Settings

Global surfaces:

- Command palette
- Current local inventory status
- Active run indicator
- Approval queue indicator
- Desktop bridge status

## Main Navigation

Use a compact left sidebar designed for desktop:

- Mission Control
- New Mission
- Teams
- Runs
- Runtimes
- Console
- Approvals
- Deliverables
- Settings

Secondary navigation can appear inside screens as segmented controls, tabs, or filters. Avoid badge counts unless backed by real persisted/local data.

## Key Screens

### Home / Mission Control

Purpose: show the real current state of the cockpit without fake activity.

Layout:

- Top band: local desktop status, active mission if any, approval queue if any.
- Left/main: active missions and recent real runs.
- Right rail: runtime readiness summary, next recommended action, approval queue.
- Empty state: “No missions running yet” with “Create mission” and “Inspect runtimes.”

For non-technical users: show mission status in plain English.

For technical users: include a compact “Inspect runtime state” path.

### New Mission

Purpose: let users start useful multi-agent work without thinking in commands.

Layout:

- Mission brief composer with plain-English prompt.
- Template picker: “Research and summarize,” “Refactor a repo,” “Draft a plan,” “Review a deliverable,” “Investigate an issue.”
- Scope controls: project folder, allowed tools, risk level, approval policy.
- Team recommendation panel: proposed agent roles, responsibilities, and required runtimes.
- Preflight panel: runtime readiness, missing config, credentials needed, and approvals required.

No mission should imply agents are available unless runtime and team prerequisites are real.

### Agent Teams

Purpose: define reusable role groups without pretending they are running.

Layout:

- Team cards with role composition, supported mission types, required runtimes.
- Team detail pane with role instructions, tool permissions, approval rules.
- Empty state: “No teams configured yet.”

Teams are configurations until attached to a real mission/run.

### Runs / Work Timeline

Purpose: show real work history and live run progress.

Layout:

- Timeline with run states: queued, planning, awaiting approval, running, blocked, succeeded, failed, cancelled.
- Each event has a source: runtime, user, approval, system, deliverable.
- Detail drawer with stdout/stderr, logs, artifacts, and command recipe metadata.

If no run store exists yet, show “No real run history is connected yet.”

### Agent Runtimes

Purpose: inspect truthful local runtime readiness.

Layout:

- Summary band: ready, needs config, needs credentials, missing, not scanned, services running.
- Runtime cards for Claude Code, Codex CLI, Gemini CLI, Hermes, OpenClaw.
- Each card shows name, category, version, readiness, diagnosis, primary safe action, docs/config hint.
- Service cards show local process state, port state, and tunnel/port-in-use warnings.

No browser-mode list of fake local tools. Browser mode should show desktop bridge required.

### Agent Console

Purpose: technical run surface for direct local agent invocation.

Layout:

- Runtime selector with readiness labels.
- Project path validation.
- Prompt composer.
- Run transcript with stdout/stderr/status.
- Safety explainer: renderer sends structured payload only; command recipes live in main process.

Keep this compact and operator-focused.

### Approvals

Purpose: make risky or irreversible steps explicit.

Layout:

- Queue grouped by mission/run.
- Approval cards with plain-English request, risk level, command/recipe preview, affected project, and timeout.
- Actions: approve, reject, request changes, inspect technical details.

No command execution from approval cards unless an allowlisted main-process implementation exists.

### Deliverables

Purpose: let non-technical users review outputs.

Layout:

- Deliverable cards with title, mission, status, last updated, and review state.
- Preview pane for summaries, plans, files, diffs, or reports.
- Review actions: accept, request revision, send back to mission, export/open.

Technical detail escape hatch: show source run, agent steps, logs, and files changed.

### Settings

Purpose: configure local preferences and safe defaults.

Layout:

- Desktop bridge and inventory settings.
- Runtime paths and config presence.
- Approval policy.
- Team templates.
- Data retention and local storage.
- Privacy/sanitization controls.

## Non-Technical UX Concepts

- Mission templates: start from outcomes, not runtimes.
- Plain-English status: “Waiting for approval,” “Needs a project folder,” “Claude Code is installed,” “Hermes needs config.”
- Approval gates: clear risk and impact before any sensitive action.
- Deliverable review: outputs are reviewed like documents, not terminal logs.
- Guided next actions: each empty/error state should offer one useful next step.
- Inspect technical details: every plain-English surface links to logs, runtime state, and command previews.

## Technical UX Concepts

- Runtime cards: canonical readiness, version, diagnosis, docs/config hints, safe primary action.
- Health checks: metadata-first; execution only through trusted main-process flows.
- Logs: source-tagged, searchable, and collapsible.
- Local process state: process/port evidence must be sanitized and truthful.
- Command palette: create mission, open project, refresh inventory, inspect runtime, jump to run.
- Run console: direct operator surface for structured, read-only or approved agent runs.

## Visual Language

### Color

Use a restrained neutral base with purposeful status colors. Avoid one-note purple/blue gradients. Recommended palette direction:

- Background: near-black graphite or deep neutral.
- Surfaces: layered charcoal with subtle borders.
- Primary accent: electric cyan or clean blue-green, used sparingly.
- Status: green ready, amber needs action, red failed/broken, gray unknown/stopped, blue informational.

### Type

- Use compact, high-legibility type.
- Small headings in cards; reserve large type for screen titles and empty-state explanations.
- Monospace only for commands, paths, logs, versions, and IDs.

### Spacing and Density

- Desktop density should be compact but not cramped.
- Prefer rows, split panes, and inspector drawers over large marketing cards.
- Use cards for repeated runtime/mission/deliverable items, not as nested decoration.

### Surfaces

- Main content: full-width bands and split panes.
- Cards: runtime cards, mission cards, approval cards, deliverable cards.
- Drawers: technical detail, logs, inventory evidence.
- Modals: approvals and destructive confirmations only.

### Motion

Motion should be subtle and operational:

- Progress pulses for active real runs only.
- Smooth drawer transitions.
- No decorative bokeh, blobs, or ambient motion unrelated to state.

### Status Treatment

Every status chip should map to a canonical state and diagnosis. Unknown, not scanned, forwarded, port in use, and needs credentials should be visible and distinct.

## Component Ideas

- Mission brief composer: plain-English prompt, scope, template, approval policy.
- Agent/team cards: role, capability, required runtimes, availability.
- Runtime cards: name, category, version, readiness, diagnosis, primary safe action.
- Status chips: canonical state label plus tooltip/diagnosis.
- Command palette: commands grouped by mission, runtime, run, settings.
- Run timeline: state transitions and sourced events.
- Approval cards: risk, request, affected resources, safe preview.
- Deliverable cards: output summary, review status, source run.
- Empty states: truthful explanation plus one practical next action.
- Action bars: compact, contextual, keyboard-accessible.

## Design Directions

### Direction A: Operator Cockpit

Dense technical control plane with Mission Control as a real-time operations screen.

Pros:

- Best for developers and power users.
- Strong fit for local runtime truthfulness.
- Easy to evolve from the current Agent Runtimes and Console screens.

Cons:

- Less approachable for non-technical users.
- Missions may feel secondary unless intentionally elevated.

### Direction B: Mission-First Studio

Home screen centers on mission creation, templates, approvals, and deliverables. Technical runtime state is present but secondary.

Pros:

- Strongest for non-technical multi-agent orchestration.
- Makes outcomes and deliverables the main mental model.
- Helps avoid “agent process UI” complexity for casual users.

Cons:

- Risks hiding important local readiness issues.
- Requires more product scaffolding before it feels useful.

### Direction C: Dual-Layer Cockpit

Mission Control is the default screen, with a persistent local readiness rail and fast command palette. Technical views remain first-class but one level deeper.

Pros:

- Balances both audiences.
- Lets non-technical users start with missions while operators retain dense inspection tools.
- Fits desktop-first agent ops better than a web dashboard model.
- Provides a clean migration path from current runtime/inventory work.

Cons:

- Requires careful IA so it does not become two apps.
- Needs consistent state language across missions and runtimes.

## Recommended Direction

Choose Direction C: Dual-Layer Cockpit.

Conductor’s advantage is not just launching agents; it is making local agent work understandable, inspectable, and safe. A dual-layer cockpit supports non-technical mission orchestration without weakening the technical operator foundation. Mission Control can become the welcoming default, while Agent Runtimes, Console, Logs, and Approvals remain precise and dense.

## Migration Plan

1. Stabilize runtime truthfulness.
   - Keep canonical readiness model.
   - Improve runtime cards and service state.
   - Preserve desktop bridge/browser honesty.

2. Add real empty-state scaffolding for mission concepts.
   - Mission Control empty state.
   - New Mission composer shell.
   - Approvals and Deliverables empty states.

3. Add local data model.
   - Persist missions, runs, teams, approvals, deliverables.
   - No fake activity.

4. Connect real run events.
   - Agent Console runs feed Runs / Work Timeline.
   - Approval queue reflects actual pending actions.

5. Layer in templates and team configuration.
   - Mission templates.
   - Role-based team definitions.
   - Runtime preflight checks.

## First Implementation Slice

After approval, implement a documentation-backed UI shell for Direction C without fake data:

- Rename default landing view to Mission Control.
- Add a truthful Mission Control empty state with:
  - Create New Mission
  - Inspect Agent Runtimes
  - Open Agent Console
  - Desktop inventory status
- Add a New Mission screen shell with mission brief composer, template placeholders, and runtime preflight area.
- Add Approvals and Deliverables empty-state screens.
- Keep Agent Runtimes and Agent Console powered by real desktop state.
- Do not create synthetic missions, agents, runs, approvals, or deliverables.
