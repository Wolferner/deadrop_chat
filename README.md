# deadrop_chat

A Node.js backend API for the deadrop_chat application, built with Fastify and TypeScript.

## Stack

- **Runtime**: Node.js
- **Framework**: Fastify 5
- **Language**: TypeScript 6
- **Validation**: Zod 4
- **Test runner**: Vitest

## Architecture

Domain-driven layered structure:

- `src/domain/` — entities, value objects, domain services (no external dependencies)
- `src/application/` — use cases, repository interfaces
- `src/infrastructure/` — HTTP routes, external adapters, seed data

Dependencies flow inward: infrastructure depends on application, application depends on domain.

## Prerequisites

- Node.js 20+
- Environment variables (see `.env.example`):
  - `PORT` — port to listen on
  - `HOST` — bind address
  - `ALLOWED_ORIGINS` — comma-separated allowed CORS origins

## Getting started

```bash
git clone https://github.com/Wolferner/deadrop_chat.git
cd deadrop_chat
npm install
cp .env.example .env
npm run dev
```

## Scripts

| Script         | Description                                      |
| -------------- | ------------------------------------------------ |
| `dev`          | Start dev server with hot reload                 |
| `build`        | Compile TypeScript to `dist/`                    |
| `start`        | Run compiled output                              |
| `lint`         | Run ESLint                                       |
| `lint:check`   | ESLint check (no fix)                            |
| `format:check` | Prettier check                                   |
| `format:write` | Prettier auto-format                             |
| `typecheck`    | TypeScript type check                            |
| `test`         | Run tests with Vitest                            |
| `ci:check`     | Full CI check (typecheck + format + lint + test) |

## Project structure

```
src/
  domain/          # Entities, value objects, domain services
  application/     # Repository interfaces, use cases
  infrastructure/  # HTTP routes, external adapters, seed data
test/              # Test setup and helpers
```
