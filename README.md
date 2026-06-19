# Healthcare SaaS

A professional MERN stack monorepo containing separate frontend and backend applications.

## Project Layout

- `client/` — React + Vite frontend
- `server/` — Express + Node backend
- `package.json` — root workspace configuration with npm workspaces
- `tsconfig.json` — shared TypeScript settings

## Install Dependencies

```bash
npm install
```

## Run in Development

```bash
npm run dev:server
npm run dev:client
```

## Build for Production

```bash
# Build both workspaces from the repo root
npm run build

# Or build a single workspace
npm run build --workspace=client
npm run build --workspace=server
```

## Backend

The backend is available at `http://localhost:3000/api` and includes a health endpoint:

- `GET /api/health`

## Frontend

The frontend runs on `http://localhost:5173`.

## Notes

- Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`, then fill in the values.
- The backend includes a MongoDB connection helper in `server/src/config/db.ts`. If `MONGODB_URI` is unset (or `USE_IN_MEMORY_DB=true`), it starts an in-memory MongoDB for local development.
- The frontend includes a shared API client in `client/src/services/api.ts` (handles auth headers and token refresh).

## Documentation

- [Authentication](docs/AUTHENTICATION.md)
- [Quick Start](docs/QUICK_START.md)
- [Attributions](docs/ATTRIBUTIONS.md)
