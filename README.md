# hue-manager

Slice 3 tracer bullet implemented with:

- React frontend shell
- Hono backend endpoints (`/api/health`, `/api/lights`)
- Shared Zod contract validation
- Tailwind CSS + shadcn-style component foundation
- Lights dashboard with search/filter/sort UX

## Run locally

1. Install dependencies:

```bash
vp install
```

2. Start frontend + backend:

```bash
vp run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8787`
- Optional: set `VITE_HEALTH_POLL_MS` to configure health polling cadence (default `10000`, minimum `1000`).

## What this slice proves

- Frontend and backend run together locally.
- Frontend fetches `/api/health` and `/api/lights` through Vite proxy.
- Backend responses and frontend boundaries both validate via shared Zod schemas (`shared/contracts/*`).
- Overview page renders bridge/sync health and a lights dashboard with search, room/zone filters, and sort controls.

## Scripts

- `vp run dev` - run backend + frontend together
- `vp run dev:backend` - run Hono backend only
- `vp run dev:frontend` - run React frontend only
- `vp check` - format/lint/type checks through Vite+
- `vp test` - run tests
- `vp run build` - production build
