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
npm run build:client
npm run build:server
```

## Backend

The backend is available at `http://localhost:3000/api` and includes a health endpoint:

- `GET /api/health`

## Frontend

The frontend runs on `http://localhost:5173`.

## Notes

- Use `server/.env.example` to create `server/.env`.
- The backend includes a MongoDB connection helper in `server/src/config/db.ts`.
- The frontend includes a shared API client in `client/src/services/api.ts`.
