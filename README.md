# Jira Team Work Log Tracking API (NestJS + Vercel)

A NestJS API that reads Jira work logs, tracks team effort by report date, and sends summaries to Google Chat.

## Features

- Pull issues/worklogs from Jira with paging support.
- Aggregate worklogs by report date and timezone.
- Deliver report to Google Chat in two modes:
  - `webhook` mode (incoming webhook)
  - `app` mode (Google Chat App + service account)
- Trigger report from API endpoints and Vercel cron.
- Keep report flow modular with layered architecture.

## Architecture

The report feature is split into layers under `src/report`:

```text
src/report/
----| application/
----| ----| report-runner.service.ts
----| domain/
----| ----| report.types.ts
----| ----| report.ports.ts
----| ----| value-objects.ts
----| ----| report-aggregation.service.ts
----| infrastructure/
----| ----| report-config.service.ts
----| ----| jira-api.service.ts
----| ----| chat-delivery.service.ts
----| report.service.ts
----| report.controller.ts
----| report.scheduler.ts
```

Vercel serverless wrappers live in `api/` and forward requests to the Nest app via `api/_handler.ts`.

## Requirements

- Node.js: `>=22 <25`
- pnpm: project uses `pnpm@11.0.8`

## Setup

1. Install dependencies:

```bash
corepack enable
pnpm install
```

1. Copy and configure environment variables:

```bash
cp .env.example .env
```

1. Build and run locally:

```bash
pnpm run build
pnpm run start:dev
```

Default local URL: `http://localhost:3000`

## Environment Variables

Reference template: `.env.example`

### Required for runtime

- `TEAM_NAME`
- `JIRA_DOMAIN`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `CRON_SECRET` for protected triggers in production

### Chat mode selection

- `GOOGLE_CHAT_MODE`: `webhook` or `app`

If `GOOGLE_CHAT_MODE=webhook`:

- `WEBHOOK` (required)

If `GOOGLE_CHAT_MODE=app`:

- `GOOGLE_CHAT_SPACE` (required)
- `GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL` (required)
- `GOOGLE_CHAT_SERVICE_ACCOUNT_PRIVATE_KEY` (required, keep newlines escaped as `\n` in `.env`)

### Optional but recommended

- `APP_BASE_URL` (used to generate retry button URL)
- `REPORT_TIMEZONE` (highest timezone priority)
- `TZ` (fallback timezone)
- `REPORT_DATE` (force report date, format `YYYY-MM-DD`)
- `REPORT_DEBUG`, `REPORT_DEBUG_AUTHORS`
- `API_BASE_PATH` (override API prefix when needed)

## Endpoints

### Nest routes (local and internal app routing)

- `GET /` landing page
- `GET /help` quick guide page
- `GET /health` health status
- `POST /reports/run` manual trigger
- `GET /reports/retry` retry trigger
- `POST /reports/chat/events` Google Chat events callback

### Vercel routes (public deployment)

`api/_handler.ts` strips `/api` prefix and forwards to Nest routes.

Examples:

- `POST /api/reports/run` -> `POST /reports/run`
- `GET /api/reports/retry` -> `GET /reports/retry`
- `POST /api/reports/chat/events` -> `POST /reports/chat/events`
- `GET /api` -> `GET /`
- `GET /api/help` -> `GET /help`
- `GET /api/health` -> `GET /health`

There is also a dedicated cron handler:

- `GET /api/cron`

`/api/cron` validates `CRON_SECRET` from either:

- `Authorization: Bearer <CRON_SECRET>`
- `?token=<CRON_SECRET>`

If `CRON_SECRET` is empty, token check is bypassed (local-friendly mode).

## Local Testing

Health check:

```bash
curl http://localhost:3000/health
```

Manual run:

```bash
curl -X POST "http://localhost:3000/reports/run?token=YOUR_CRON_SECRET"
```

Retry run:

```bash
curl "http://localhost:3000/reports/retry?token=YOUR_CRON_SECRET"
```

Vercel-style local path test:

```bash
curl -X POST "http://localhost:3000/api/reports/run?token=YOUR_CRON_SECRET"
```

## Scripts

- `pnpm run build` compile Nest app
- `pnpm run start` start compiled app
- `pnpm run start:dev` run in watch mode
- `pnpm run test` run tests in-band
- `pnpm run test:coverage` run coverage (threshold is strict)
- `pnpm run test:ci` CI test mode
- `pnpm run ci:verify` coverage + build + phrase checks
- `pnpm run cron:run` run compiled cron runner
- `pnpm run cron:dev` install/build/run cron flow

## Vercel Deploy

1. Link project:

```bash
pnpm dlx vercel login
pnpm dlx vercel link
```

1. Set production env vars (`TEAM_NAME`, Jira credentials, chat mode vars, `APP_BASE_URL`, `CRON_SECRET`, timezone vars).

1. Deploy:

```bash
pnpm dlx vercel --prod --yes
```

### Cron schedule

Configured in `vercel.json`:

- path: `/api/cron`
- schedule: `0 10 * * 1-5`

This is 10:00 UTC (17:00 GMT+7), Monday to Friday.

## Troubleshooting

### 401 Invalid or missing cron secret

- Ensure `CRON_SECRET` is set.
- Pass token via `x-cron-secret`, `Authorization: Bearer ...`, or `?token=...` depending on endpoint.

### Retry button not shown in Google Chat

- Check `APP_BASE_URL` format.
- Ensure webhook mode is used for retry link cards.
- If `CRON_SECRET` is empty, retry URL is still generated but public.

### Jira request failure

- Verify `JIRA_DOMAIN`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.
- Confirm `TEAM_NAME` matches Jira project key in your data model.

### Timezone/date mismatch

- Prefer setting `REPORT_TIMEZONE` explicitly.
- Use `REPORT_DATE` for forced-date validation.

## Security Notes

- Never commit `.env`, `.env.local`, or secrets.
- Keep `CRON_SECRET` enabled in production.
- Do not expose service-account private key in logs.

## Community

- Contributions are welcome. See `CONTRIBUTING.md`.
- Community standards and behavior: `CODE_OF_CONDUCT.md`.
- Responsible disclosure process: `SECURITY.md`.
- Open pull requests against branch `vercel-deploy` using `.github/PULL_REQUEST_TEMPLATE.md`.
