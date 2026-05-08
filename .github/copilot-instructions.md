# Copilot Instructions for This Repository

## Project Priorities

- Keep code clean, modular, and easy to extend.
- Prefer layered architecture in `src/report/`:
  - `application` for use-case orchestration
  - `domain` for shared contracts/types
  - `infrastructure` for external I/O and configuration

## Naming and Configuration Rules

- Do not hardcode team identifiers such as `BKM4` in runtime logic.
- Use `TEAM_NAME` from environment variables for team/project identity.
- When a slug is needed (domain or service examples), derive lowercase kebab-case from `TEAM_NAME`.

## Environment Rules

- Keep required env validation centralized in config services.
- Keep `.env` and `.env.local` out of git.
- Ensure `.env*.local` remains ignored.

## API and Runtime Rules

- Keep `/reports/run` as `POST`.
- Keep `/reports/retry` as `GET`.
- Keep token checks driven by `CRON_SECRET` (optional in local, required in production).

## Documentation Rules

- Write `README.md` in English.
- Keep README complete and aligned with current code:
  - setup
  - environment variables
  - endpoint usage
  - local testing
  - Vercel deploy
  - troubleshooting
- Do not use local folder names as product identity.
- When showing architecture trees and specifically requested, use `----|` style.

## Change Safety

- Prefer minimal, targeted edits.
- Do not refactor unrelated files unless requested.
- After changes, run a build or relevant checks when practical.
