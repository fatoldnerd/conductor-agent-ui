# Conductor macOS artifact smoke test steps

Purpose: verify the packaged Conductor desktop app from GitHub Actions. This is not the hosted web app. The desktop app is the only build that can use the Electron bridge, inspect a local repo, request native approval, and start the fixed read-only repo review mission.

Artifact under test:
- GitHub Actions run: https://github.com/fatoldnerd/conductor-agent-ui/actions/runs/25548569392
- Commit: 07c91c253a52cfacc0a070b059d8a8d8ee4b7746
- Artifact: conductor-macos-unsigned

## A. Download and open the app

1. On your Mac, open this URL:
   https://github.com/fatoldnerd/conductor-agent-ui/actions/runs/25548569392

2. Scroll to the Artifacts section near the bottom of the run page.

3. Click `conductor-macos-unsigned` to download it.

4. Open your Downloads folder.

5. Double-click the downloaded zip if macOS did not unzip it automatically.

6. Look for either:
   - `Conductor.app`, or
   - a `.dmg` file containing `Conductor.app`.

7. If you see a `.dmg`, double-click it, then drag or open `Conductor.app` from inside it.

8. Open `Conductor.app`.

9. If macOS blocks it as unsigned:
   - right-click or control-click `Conductor.app`
   - choose `Open`
   - click `Open` again in the warning dialog

10. If macOS still blocks it, open Terminal on your Mac and run this only after adjusting the path if needed:

```bash
xattr -dr com.apple.quarantine ~/Downloads/Conductor.app
```

If you moved it to Applications, use:

```bash
xattr -dr com.apple.quarantine /Applications/Conductor.app
```

Then open `Conductor.app` again.

## B. Basic launch check

Expected result: the app opens to the Conductor UI.

Pass if:
- The window opens.
- It is not blank black or blank white.
- The left sidebar is visible.
- The sidebar includes `Mission Control`, `Agent Runtimes`, `Activity`, and other sections.

Fail if:
- The app never opens.
- The app opens to a blank window.
- The UI is visibly broken before you click anything.

## C. Run the read-only repo readiness check

This is the exact flow I need you to test.

1. In the left sidebar, click `Mission Control`.

2. Find the card titled or labelled `Read-only repo readiness inspection`.

3. In the field labelled `Local repository path`, paste the full path to a local repo on that Mac.

   Recommended path on your Mac if the Conductor repo is present there:

```text
/Users/bradtowers/Documents/App Projects/conductor-agent-ui
```

   If that path does not exist on the Mac you are using, use any local Git repo path you know exists.

4. Click the button labelled `Run read-only readiness check`.

5. Wait a few seconds.

6. Look directly below that button. A result box should appear.

When I say “confirm the result”, I mean confirm that this result box appears and contains a readable summary. It should include lines like:

- `<repo name>: Ready for read-only agent review` or `<repo name>: Needs attention before agent review`
- `Readiness score <number>/100`
- `Package manager: ...`
- `Git: detected` or `Git: not detected`
- `Tests: detected` or `Tests: missing`
- `Build: detected` or `Build: missing`
- `README: detected` or `README: missing`
- either `Risk notes: ...` or `No risk notes detected from allowlisted metadata.`

Pass if:
- The result box appears.
- The repo name roughly matches the folder you entered.
- The text is readable and not jammed together.
- It does not show full secret values, env vars, or command output.

Fail if:
- The button is disabled even though the path is filled in.
- Nothing happens after clicking.
- You get an error.
- The result shows weird/private data such as tokens, environment variables, or raw shell output.

## D. Start the approved repo review mission

Only do this after the readiness result box appears.

1. Still on `Mission Control`, stay inside the result box from the readiness check.

2. Look for a section titled `Start approved repo review`.

3. It should say something like:
   `Native approval required. Fixed runtime: Codex CLI read-only. Electron main owns the prompt and the allowlisted recipe.`

4. Click the button labelled `Start approved repo review`.

5. macOS / Electron should show a native approval dialog before anything runs.

6. Read the dialog. It should describe a fixed read-only repo review action, not a generic shell command.

7. Approve it if you are comfortable.

8. Watch the Mission Control result area.

Expected result after approval:
- You should see a nested box with `Repo review mission: ...`
- Lifecycle/status text should move through states such as:
  - `Awaiting native approval`
  - `Approval confirmed`
  - `Codex running`
  - `Review completed`
- A section labelled `Review report deliverable` should appear.

Pass if:
- Native approval appears before the run starts.
- The action is clearly read-only/fixed, not generic command execution.
- Status/lifecycle text appears.
- A `Review report deliverable` section appears.

Fail if:
- No native approval appears.
- It starts running immediately without approval.
- The UI exposes a command box or arbitrary shell execution.
- It crashes or hangs indefinitely.

## E. Check Activity persistence

1. In the left sidebar, click `Activity`.

2. Look for a recent repo review mission entry.

3. Confirm it shows sanitized information only, such as:
   - repo name
   - runtime
   - status
   - timestamps
   - short deliverable preview

4. Quit Conductor completely.

5. Open Conductor again.

6. Click `Activity` again.

7. Confirm the repo review mission entry is still there.

Pass if:
- The entry appears before quitting.
- The entry still appears after reopening.
- It does not show full local path, prompt text, command argv, environment variables, or secrets.

Fail if:
- No Activity entry appears.
- The entry disappears after reopening.
- It leaks full private/local details.

## F. Report back to Hermes

Reply with this filled in:

```text
App opens: pass/fail
Mission Control visible: pass/fail
Repo path used: <path>
Readiness check result appeared: pass/fail
Readiness score shown: <score or not shown>
Start approved repo review button appeared inside/below result: pass/fail
Native approval appeared before run: pass/fail
Repo review completed: pass/fail
Review report deliverable appeared: pass/fail
Activity entry appeared: pass/fail
Activity entry persisted after reopen: pass/fail
Any ugly/confusing UI: <short note>
Any leaked local/private info: <short note>
Screenshot taken if something failed: yes/no
```

## G. If something fails

If possible, take a screenshot and tell Hermes exactly which step failed.

Most useful failure notes:
- The exact button or section you clicked.
- The repo path you entered.
- The exact visible error text.
- Whether you were using your primary laptop or the Mac Mini.
- Whether Codex CLI is installed on that Mac.
