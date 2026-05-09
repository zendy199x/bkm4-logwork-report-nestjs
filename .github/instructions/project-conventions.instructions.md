---
description: "Use when editing report flows, environment configuration, health/readme pages, or deployment docs in this NestJS API project."
applyTo: "src/report/**, src/health.controller.ts, README.md, .env.example"
---

# Project Conventions

## Architecture

- Keep `src/report/` layered and explicit:
  - `application`: use-case orchestration
  - `domain`: contracts/types/value objects/pure business logic
  - `infrastructure`: external APIs, runtime config, side effects
- Keep controllers/facades thin; orchestration belongs in application services.

## Team Identity and Naming

- Avoid hardcoded team names in runtime logic.
- Use `TEAM_NAME` as the source for report title and Jira project key context.
- When generating a slug, derive lowercase kebab-case from `TEAM_NAME`.

## Environment Configuration

- Keep required env validation centralized in config services.
- For this project, prefer updating env rules in `ReportConfigService` rather than spreading checks.
- Keep `.env`, `.env.local`, and `.env*.local` out of git.
- Keep `.env.example` complete and synchronized with actual runtime requirements.

## API and Security Rules

- Keep these endpoint contracts unchanged unless explicitly requested:
  - `POST /reports/run`
  - `GET /reports/retry`
  - `POST /reports/chat/events`
- Keep token authorization behavior driven by `CRON_SECRET`.
- Local may allow empty `CRON_SECRET`; production should require it.

## Documentation Rules

- README must be in English.
- Keep README accurate to current behavior and deployment:
  - setup
  - env vars
  - endpoint usage (Nest and `/api/*` Vercel mapping)
  - local testing
  - Vercel deploy
  - troubleshooting
- Do not use local folder names as product identity.
- If an architecture tree format is explicitly requested, use `----|` style.

## Change Safety

- Prefer minimal, focused edits tied to the task.
- Avoid unrelated refactors.
- After changing covered files, run practical checks where possible (typecheck/tests/build).
