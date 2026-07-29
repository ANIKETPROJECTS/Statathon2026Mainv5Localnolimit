# AIRAVATA DEA — CSV Data Profiler

## Overview

A pnpm monorepo containing a CSV/fixed-width file conversion, anonymisation, and risk assessment web app (React + Vite), backed by an Express API server.

### Packages

| Path | Name | Purpose |
|------|------|---------|
| `artifacts/csv-profiler` | `@workspace/csv-profiler` | React/Vite frontend — FWF converter, CSV profiler, risk assessment |
| `artifacts/api-server` | `@workspace/api-server` | Express API (port 3001 in dev) |
| `lib/api-client-react` | `@workspace/api-client-react` | Tanstack Query hooks for the API |
| `lib/api-zod` | `@workspace/api-zod` | Shared Zod schemas |
| `lib/db` | `@workspace/db` | Drizzle ORM schema + migrations (PostgreSQL) |

## How to run

The **Start application** workflow runs both the Vite dev server and the API server together:

```
pnpm --filter @workspace/csv-profiler run dev
```

- Frontend: http://localhost:5000  
- API server: http://localhost:3001

Install all dependencies from the workspace root:

```
pnpm install
```

## User preferences

_None recorded yet._
