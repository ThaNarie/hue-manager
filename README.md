# hue-manager

Slice 1 tracer bullet implemented with:

- React frontend shell
- Hono backend endpoint
- Shared Zod contract validation
- Tailwind CSS + shadcn-style component foundation

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start frontend + backend:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8787`

## What this slice proves

- Frontend and backend run together locally.
- Frontend fetches `/api/health` through Vite proxy.
- Backend response and frontend boundary both validate via the same shared Zod schema (`shared/contracts/health.ts`).
- Overview page renders bridge/sync health card from typed backend data.

## Scripts

- `npm run dev` - run backend + frontend together
- `npm run dev:backend` - run Hono backend only
- `npm run dev:frontend` - run React frontend only
- `npm run check` - format/lint/type checks through Vite+
- `npm run test` - run tests
- `npm run build` - production build
