# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # dev server with hot reload (tsx watch)
npm run build         # compile TypeScript to dist/
npm run start         # run compiled output
npm run typecheck     # type check without emitting
npm run lint          # ESLint with auto-fix
npm run lint:check    # ESLint check only
npm run format:write  # Prettier auto-format
npm run format:check  # Prettier check only
npm run test          # run Vitest
npm run ci:check      # full CI gate: typecheck + format + lint + test
```

Husky runs lint-staged on pre-commit (ESLint + Prettier on staged files).

## Architecture

DDD-inspired layered structure with strict inward dependency flow:

- `src/domain/` — entities, value objects, domain services. No external dependencies allowed here.
- `src/application/` — use cases and repository interfaces (contracts only, no implementations).
- `src/infrastructure/` — Fastify HTTP routes, external adapters (Prisma ORM), seed data.

Infrastructure depends on application; application depends on domain. Domain is pure.

Entry point is `src/index.ts` — bootstraps the Fastify server using `HOST`/`PORT` env vars.

## Key constraints

- **ESM only** — `"type": "module"` in package.json; all imports must use `.js` extensions (TypeScript resolves them via `verbatimModuleSyntax` + `NodeNext`).
- **Strict TypeScript** — `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on; array index access returns `T | undefined`.
- **Path alias** — `@` resolves to the project root (configured in both `tsconfig.json` and `vitest.config.ts`).
- **Validation** — Zod 4 is the validation library; use it at HTTP boundary (infrastructure layer), not in domain.

## Environment

Copy `.env.example` to `.env`. Required vars: `PORT`, `HOST`, `ALLOWED_ORIGINS` (comma-separated).
