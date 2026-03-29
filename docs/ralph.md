# Ralph CLI (Slice 6)

Ralph now supports end-to-end issue execution with deterministic selection, worker execution, quality gates, and publish flow.

## Scripts

- `vp run ralph:doctor`: validates required env vars and local tooling, then auto-creates missing lifecycle labels.
- `vp run ralph:once`: runs one full cycle (select issue, execute worker, run checks, publish).
- `vp run ralph:start`: runs the full cycle continuously using `loopIntervalMs` from `ralph.config.json`.

You can also run the same scripts via `npm run` if preferred.

## Configuration

Non-secret config lives in `ralph.config.json`:

- `repo`: GitHub repo in `owner/repo` format.
- `loopIntervalMs`: loop interval used by `ralph:start`.
- `maxWorkers`: maximum concurrent issue workers Ralph can run.
- `idleBackoffMaxMs`: max delay cap when no eligible work exists.
- `idleBackoffJitterMs`: random jitter added to idle polls.
- `baseBranch`: base branch for issue worktree and PR target.
- `workerImage`: Docker image used to run the worker.
- `workerTimeoutMs`: hard timeout for a worker run.
- `requiredLabels`: lifecycle labels `ralph:doctor` ensures exist.

## Worker and publish flow

For each claimed issue, Ralph performs this sequence:

1. Creates an isolated git worktree and deterministic issue branch (`ralph/issue-XXXXXX`).
2. Fetches issue context from GitHub and writes a prompt artifact.
3. Runs Cursor CLI in Docker using non-interactive flags (`--force --print`).
4. Enforces quality gates before publishing:
   - `vp run build`
   - `vp test`
   - `vp check --fix`
5. Creates one final commit on the issue branch.
6. Pushes the branch and either:
   - reuses an existing open PR for that branch, or
   - creates a new PR targeting `baseBranch`.

Run artifacts are written under `.ralph/artifacts/<runId>/` (logs, manifest, prompt, and publish metadata).

## Required Secrets

Set these env vars before running Ralph:

- `GITHUB_TOKEN`
- `CURSOR_API_KEY`

Example:

```sh
export GITHUB_TOKEN=...
export CURSOR_API_KEY=...
```
