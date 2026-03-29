# Ralph CLI (Slice 1)

Ralph now has bootstrap commands for setup validation and deterministic runtime entrypoints.

## Scripts

- `vp run ralph:doctor`: validates required env vars and local tooling, then auto-creates missing lifecycle labels.
- `vp run ralph:once`: runs a single bootstrap cycle (no worker orchestration yet).
- `vp run ralph:start`: runs bootstrap in a continuous loop using `loopIntervalMs` from `ralph.config.json`.

You can also run the same scripts via `npm run` if preferred.

## Configuration

Non-secret config lives in `ralph.config.json`:

- `repo`: GitHub repo in `owner/repo` format.
- `loopIntervalMs`: loop interval used by `ralph:start`.
- `requiredLabels`: lifecycle labels `ralph:doctor` ensures exist.

## Required Secrets

Set these env vars before running Ralph:

- `GITHUB_TOKEN`
- `CURSOR_API_KEY`

Example:

```sh
export GITHUB_TOKEN=...
export CURSOR_API_KEY=...
```
