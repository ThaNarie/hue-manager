# Ralph CLI (Slice 6)

Ralph now supports end-to-end issue execution with deterministic selection, worker execution, quality gates, and publish flow.

## Scripts

- `vp run ralph:doctor`: validates required env vars and local tooling, then auto-creates missing lifecycle labels.
- `vp run ralph:worker:build`: builds the dedicated Ralph worker image with Cursor CLI and `gh` preinstalled.
- `vp run ralph:once`: runs one full cycle (select issue, execute worker, run checks, publish).
- `vp run ralph:start`: runs the full cycle continuously using `loopIntervalMs` from `ralph.config.json`.
- `vp run ralph:cleanup`: prunes artifacts older than retention and removes retained successful-run worktrees.

You can also run the same scripts via `npm run` if preferred.

## Configuration

Non-secret config lives in `ralph.config.json`:

- `repo`: GitHub repo in `owner/repo` format.
- `loopIntervalMs`: loop interval used by `ralph:start`.
- `maxWorkers`: maximum number of concurrently active scheduler workers.
- `idleBackoffMaxMs`: cap for idle polling backoff when no eligible work exists.
- `idleBackoffJitterMs`: random jitter added to idle backoff delays.
- `baseBranch`: base branch for issue worktree and PR target.
- `workerImage`: Docker image used to run the worker (default: `hue-manager-ralph-worker:latest`).
- `workerTimeoutMs`: hard timeout for a worker run.
- `cleanupRetentionDays`: retention window in days for cleanup (default: `14`).
- `requiredLabels`: lifecycle labels `ralph:doctor` ensures exist.

## Worker and publish flow

For each claimed issue, Ralph performs this sequence:

1. Creates an isolated git worktree and deterministic issue branch (`ralph/issue-XXXXXX`).
2. Fetches issue context from GitHub and writes a prompt artifact.
3. Runs Cursor CLI in Docker in headless mode (`agent -p --force --workspace /workspace --model gpt-5.3-codex ...`).
4. Enforces quality gates before publishing:
   - `vp run build`
   - `vp test`
   - `vp check --fix`
5. Creates one final commit on the issue branch.
6. Pushes the branch and either:
   - reuses an existing open PR for that branch, or
   - creates a new PR targeting `baseBranch`.
7. Removes the ephemeral Ralph worktree after publish succeeds.

Run artifacts are written under `.ralph/artifacts/<runId>/` and now include:

- `worker.log` plus `worker.stdout.log`/`worker.stderr.log` for stream/debug visibility.
- `final-output.md` with the worker's final structured response.
- `run-manifest.json`, `cursor-prompt.md`, `result.json`, `cleanup.json`, and `publish.json`.

PR output now embeds the `final-output.md` content so reviewers can quickly inspect what Ralph implemented.

## Recommended worker image

Ralph now includes a dedicated worker image at `ralph/worker-image/Dockerfile`:

- Base: `node:22-bookworm` (glibc; compatible with Cursor CLI).
- Preinstalled tools: `agent` (Cursor CLI), `gh`, `git`, `curl`, `jq`.

Build it once before live runs:

```sh
vp run ralph:worker:build
```

This avoids per-run CLI installs and makes worker behavior deterministic.

## Required Secrets

Set these env vars before running Ralph:

- `GITHUB_TOKEN`
- `CURSOR_API_KEY`

Example:

```sh
export GITHUB_TOKEN=...
export CURSOR_API_KEY=...
```
