# Conductor Status Update - Non-Technical Version

Date: 2026-05-05

## Short version

Conductor is becoming a desktop control centre for AI agents.

The goal is to give people one safe place to see which AI tools are installed, whether they are ready to use, what needs fixing, and eventually to launch or coordinate AI work without needing to understand the terminal.

Right now, the app is not yet a finished product. It is a strong foundation. The important safety and truthfulness layers are being built first, before we add powerful buttons that can change files, install tools, or run agents.

## What the app is meant to do

Conductor is meant to make AI agent work easier and safer.

For a non-technical user, the future experience should be:

- Open the app.
- Describe what you want done.
- Choose a guided mission or template.
- Let the app check which AI tools are available.
- Review what the app plans to do.
- Approve anything risky before it happens.
- Watch progress in plain English.
- Review the final result.

For a technical user, the app should also show deeper operational detail:

- Installed AI runtimes and command-line tools.
- Local services and ports.
- Health checks.
- Configuration gaps.
- Safe action previews.
- Logs and diagnostics.

The key idea is a dual-layer cockpit:

- Simple mission layer for non-technical users.
- Technical operator layer underneath for developers and power users.

## Where we are now

We have completed the foundation phase for truthful local runtime detection and safe action modelling.

In plain English, this means:

- The app can tell the difference between things that are actually installed and things that are not.
- It no longer shows fake agents, fake activity, fake teams, fake missions, or fake running tools.
- Browser mode honestly says it cannot inspect the local machine.
- Desktop mode uses the local Electron app to inspect the machine safely.
- The app can show whether tools like Claude Code, Codex CLI, Gemini CLI, Hermes, and OpenClaw are ready, missing, stopped, broken, or need configuration.
- The app does not pretend that an SSH tunnel or a busy port means Hermes is running locally.
- The app has a safety model for future actions, but does not yet run those actions.

This matters because trust is the product. A control centre that lies about what is running is worse than useless.

## What has been built recently

Recent foundation work added several safety layers:

1. Runtime readiness model

The app now has a shared language for tool status:

- ready
- installed
- running
- missing
- needs configuration
- needs credentials
- broken
- not scanned
- stopped

2. Runtime detail panels

Each major runtime can show a more detailed explanation of what was found and what the next safe step is.

3. Preview-only actions

The app can now show suggested actions, such as install, configure, health check, or open docs, without pretending it can already execute them.

4. Approval policy

The app now has a model for whether a future action would need approval.

5. Allowlist contract

The app now has a rule that future actions must be tied to named safe desktop APIs. It cannot just run arbitrary shell commands.

6. Request envelope model

The app now has a structured request format for future actions. This means future actions will be packaged as safe, typed requests rather than raw commands.

7. CI/build cleanup

The desktop build pipeline has been updated and is passing cleanly.

## Current quality level

Automated validation is strong for this stage.

Current main branch validation:

- Tests pass.
- Web build passes.
- macOS unsigned desktop build passes in GitHub Actions.
- Desktop artifact upload succeeds.

The latest test suite has 13 test files and 66 tests passing.

## Percentage to full completion

My estimate: about 30% complete toward the full product vision.

Why only 30%, even though a lot has been done?

Because the most important foundation is now in place, but the app is not yet doing the big end-user workflow.

What is done:

- Local runtime discovery foundation.
- Truthful desktop-vs-browser behaviour.
- No fake operational data.
- Safe action preview model.
- Approval and allowlist architecture.
- Request envelope contract.
- Working desktop build pipeline.

What is not done yet:

- Real mission creation.
- Real agent orchestration.
- Real approval workflow.
- Real execution of safe actions.
- Durable run history.
- Deliverable review.
- Polished non-technical user experience.
- Packaged, signed, easy-to-install release.

## What is left to do, in non-technical terms

### 1. Add an audit trail

Before the app performs real actions, it needs a record of what was requested, what was approved, what was blocked, and what happened.

Non-technical explanation:

The app needs a flight recorder, so every important action has a clear history.

### 2. Add the approval workflow

Before anything risky happens, the user should see a clear explanation and approve it.

Non-technical explanation:

The app should say: here is what I want to do, here is why, here is the risk, do you approve?

### 3. Add real safe desktop actions

Only after the safety model is ready should the app start doing actual work, such as refreshing inventory, opening docs, running a health check, or starting a managed process.

Non-technical explanation:

We will add real buttons, but only after the app has guardrails and an audit trail.

### 4. Add Mission Control

This is the non-technical front door.

Non-technical explanation:

Instead of asking users to think about tools and runtimes, the app should let them say what they want done, then guide them through it.

Example missions:

- Review this project.
- Set up an AI coding workspace.
- Run a documentation pass.
- Compare two agents on a task.
- Prepare a deliverable.

### 5. Add real run history and deliverables

The app should remember what happened and show outputs clearly.

Non-technical explanation:

Users should be able to look back and see what the agents did, what changed, and what result was produced.

### 6. Improve the UI and onboarding

The app is functional, but not yet the premium, polished cockpit we want.

Non-technical explanation:

It works like a control panel. It still needs to feel like a product.

### 7. Package and release properly

Eventually the app needs signing, notarization, and a simple install/update path.

Non-technical explanation:

At the moment it is a developer build. Later it needs to install like a normal Mac app.

## Biggest risks

1. Safety

The app must never become a generic shell-command launcher.

2. Trust

The app must never show fake operational state or pretend something is running when it is not.

3. Usability

If the app only makes sense to developers, it misses the bigger opportunity.

4. Scope creep

It is tempting to add flashy mission features too early. The safer approach is to finish the control and approval foundation first.

## Recommended next phase

The next phase should continue building toward safe execution, still without jumping straight into powerful actions.

Recommended order:

1. Audit log model.
2. Approval workflow model.
3. Desktop action handler shell.
4. First harmless real action, probably refresh inventory or open documentation.
5. Mission Control empty shell.
6. Mission templates and guided flows.

## How to explain the current state in one paragraph

Conductor is a desktop app we are building to become a safe control centre for AI agents. Right now, we have built the trust and safety foundation: it can inspect the local machine, show which AI tools are actually available, avoid fake data, and model future actions with approval and safety checks. It does not yet run full missions or orchestrate teams of agents. The next work is to add an audit trail and approval flow, then carefully turn safe preview actions into real actions. I would say we are about 30% of the way to the full vision, with the hardest trust foundations underway but the user-facing mission workflow still ahead.
