# Copilot Instructions for This Repository

## Scope

These instructions apply to the full repository. For file-specific rules under `src/report/**`, `src/health.controller.ts`, `README.md`, and `.env.example`, also follow `.github/instructions/project-conventions.instructions.md`.

## Architecture Priorities

- Keep code clean, modular, and easy to extend.
- Preserve layered architecture in `src/report/`:
  - `application`: orchestration/use-cases
  - `domain`: contracts, types, value objects, pure logic
  - `infrastructure`: external I/O and runtime config
- Avoid leaking infrastructure concerns into domain logic.

## Naming and Configuration Rules

- Do not hardcode team identifiers (for example `BKM4`) in runtime logic.
- Use `TEAM_NAME` as the source of team/project identity.
- When a slug is needed, derive lowercase kebab-case from `TEAM_NAME`.

## Environment and Secrets

- Keep required env validation centralized in config services (currently `ReportConfigService`).
- Keep `.env` and `.env.local` out of git.
- Ensure `.env*.local` remains ignored.
- Never print secrets (`CRON_SECRET`, Jira tokens, service-account key) in logs.

## API and Runtime Behavior

- Keep report trigger routes:
  - `/reports/run` as `POST`
  - `/reports/retry` as `GET`
- Keep Google Chat events route as `POST /reports/chat/events`.
- Keep token checks driven by `CRON_SECRET`:
  - optional in local development
  - required in production
- Respect Vercel API forwarding behavior:
  - `/api/*` is mapped to Nest routes via `api/_handler.ts`
  - `/api/cron` is a dedicated cron handler

## Documentation Requirements

- Write `README.md` in English.
- Keep README complete and aligned with actual code:
  - setup
  - environment variables
  - endpoint usage
  - local testing
  - Vercel deploy
  - troubleshooting
- Do not use local folder names as product identity.
- When architecture tree formatting is explicitly requested, use `----|` style.

## Testing and Quality

- Prefer adding/updating tests in `tests/**` mirror structure for changed behavior.
- Avoid `// @ts-nocheck` in tests.
- Keep strict coverage expectations passing in `jest.config.cjs`.
- Validate with relevant commands when practical:
  - `pnpm tsc -p tsconfig.spec.json --noEmit`
  - `pnpm run test:coverage`
  - `pnpm run build`

## Change Safety

- Prefer minimal, targeted edits.
- Do not refactor unrelated files unless requested.
- Preserve public API behavior unless explicitly asked to change it.
- After changes, run a build or relevant checks when practical.
