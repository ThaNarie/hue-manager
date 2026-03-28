# hue-manager

Slice 1 tracer bullet: local frontend + backend with a typed, validated health contract.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start backend and frontend together:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8787`

The frontend calls `/api/health` through the Vite proxy, and both sides validate the response with the shared Zod contract.

## Scripts

- `npm run dev` - run backend + frontend together
- `npm run dev:backend` - run only backend
- `npm run dev:frontend` - run only frontend
- `npm run check` - format/lint/type checks through Vite+
- `npm run test` - run tests
- `npm run build` - production build
