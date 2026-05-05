# Milestone Test Checklist

Manual checklist for the current runtime-readiness and safe-action foundation milestone.

Use this with `docs/CONDUCTOR_BUILD_PLAN.md`. The goal is to verify that Conductor remains desktop-first, truthful about local runtime state, and clear that safe actions are previews or preflight details unless backed by an explicit allowlisted Electron API.

## Recommended Commands

Run before manual inspection:

```sh
npm test
npm run build
```

Run for desktop manual testing:

```sh
npm run desktop:dev
```

Optional at meaningful milestones:

- Trigger the GitHub Actions desktop build.
- Install the generated macOS artifact on a local test machine.
- Repeat the desktop checks below against the installed artifact.

## Desktop Inventory

- [ ] Open Conductor through `npm run desktop:dev`.
- [ ] Confirm Agent Runtimes loads through the Electron desktop bridge, not browser-only assumptions.
- [ ] Confirm loading, error, empty, not-scanned, and ready states use plain local-inventory language.
- [ ] Confirm no raw stderr, private paths, tokens, hostnames, SSH arguments, or tunnel targets appear in runtime summaries.
- [ ] Confirm refreshing inventory updates state from sanitized Electron inventory only.

Pass condition: desktop mode reflects real local inventory evidence and does not fabricate installed, ready, running, or connected state.

## Browser Mode

- [ ] Open the renderer URL directly in a browser.
- [ ] Confirm Agent Runtimes shows a desktop-required empty state.
- [ ] Confirm browser mode does not list known runtime rows as if local inventory was scanned.
- [ ] Confirm browser mode does not show executable runtime actions.

Pass condition: browser mode clearly says the desktop app or bridge is required and does not imply local runtime state.

## First-Class Runtime Panels

- [ ] With Claude Code installed, confirm `Claude Code` maps to canonical runtime `claude-code`.
- [ ] With Codex CLI installed, confirm `Codex CLI` maps to canonical runtime `codex-cli`.
- [ ] With Gemini CLI installed, confirm `Gemini CLI` maps to canonical runtime `gemini-cli`.
- [ ] Confirm each detected runtime panel shows readiness label, diagnosis, version when available, and truthful local evidence.
- [ ] Confirm missing or not-scanned runtimes stay distinct from ready or installed runtimes.

Pass condition: Claude Code, Codex CLI, and Gemini CLI panels render from local inventory IDs and preserve truthful ready/installed/version state.

## Hermes And OpenClaw Services

- [ ] Confirm missing Hermes CLI does not appear as ready.
- [ ] Confirm stopped OpenClaw does not appear as running.
- [ ] If ports `8642` or `9119` are occupied by SSH tunnels, confirm Hermes API/dashboard show `port_in_use` or SSH tunnel language, not running Hermes.
- [ ] If ports are occupied by a non-Hermes process, confirm the UI describes a generic port conflict.
- [ ] Confirm no private tunnel targets, hostnames, or SSH command args are displayed.

Pass condition: port presence alone never claims Hermes or OpenClaw is running.

## Broken CLI Diagnostics

- [ ] Create or observe a broken CLI version-check case, such as a package manager/Corepack shim failure.
- [ ] Confirm the affected tool appears as broken or equivalent, not missing.
- [ ] Confirm the diagnosis is a short sanitized summary.
- [ ] Confirm raw stack traces, private paths, tokens, hostnames, and shell state do not appear in UI summaries.

Pass condition: detected-but-failing tools are classified truthfully as broken and diagnostics are sanitized.

## Safe Actions And Preflight

- [ ] Confirm runtime actions show preview/preflight language.
- [ ] Confirm action metadata includes requirements, risk level, expected effect, and approval requirement.
- [ ] Confirm preview install, configure, health check, copy install command, and coming soon actions do not imply execution.
- [ ] Confirm action preview panels say they do not run commands from the renderer.
- [ ] Confirm no renderer UI accepts arbitrary shell input for runtime actions.

Pass condition: safe actions are presented as suggested next steps or preflight previews, not live install/repair/config buttons.

## No Fake Operational State

- [ ] Confirm no fake missions appear.
- [ ] Confirm no fake agents or running agents appear.
- [ ] Confirm no fake activity feed appears.
- [ ] Confirm no fake approvals appear.
- [ ] Confirm no fake deliverables appear.
- [ ] Confirm no fake connected tools appear.
- [ ] Confirm no Hugo or Kestrel instances appear as generic OpenClaw agents.

Pass condition: operational UI shows only truthful local state, honest empty states, or explicitly future/unconnected surfaces.

## Milestone Sign-Off

Record the result before tagging or cutting an artifact:

- Date:
- Commit:
- Platform:
- `npm test` result:
- `npm run build` result:
- Desktop manual result:
- Browser manual result:
- Artifact install result, if run:
- Notes or follow-up issues:
