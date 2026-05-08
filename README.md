# Logwork Report API (NestJS + Vercel)

This service fetches Jira worklogs, aggregates report data by date/timezone, and sends reports to Google Chat.

## 1. Overview

Core capabilities:

- Fetch issues and worklogs from Jira.
- Aggregate logged hours by author for the report date.
- Send text report + action buttons to Google Chat.
- Support manual triggers and scheduled cron execution on Vercel.

Notes:

- Your local folder name can be anything (for example `render-nest-api`); it does not define the runtime service identity.
- `TEAM_NAME` is used to avoid hardcoded project/team values across the app.

## 2. Architecture

The `report` module is split by responsibility:

```text
src/report/
----| application/
----| ----| report-runner.service.ts
----| domain/
----| ----| report.types.ts
----| infrastructure/
----| ----| report-config.service.ts
----| ----| jira-api.service.ts
----| ----| chat-delivery.service.ts
----| report.service.ts
----| report.controller.ts
----| report.scheduler.ts
```

Guidelines:

- Controllers call only the facade (`report.service.ts`).
- Orchestration stays in the application layer.
- External I/O (Jira, Chat, env) stays in infrastructure.
- Shared contracts/types stay in domain.

## 3. Runtime Requirements

- Node.js `22.x`
- pnpm `11.x` (project uses `pnpm@11.0.8`)

If your machine uses Node 24, build may still work but can show engine warnings.

## 4. Environment Variables

See `.env.example` for the full template.

### Required

- `TEAM_NAME` (example: `BKM4`)
- `JIRA_DOMAIN`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `GOOGLE_CHAT_MODE`

When `GOOGLE_CHAT_MODE=webhook`:

- `WEBHOOK` (required)

When `GOOGLE_CHAT_MODE=app`:

- `GOOGLE_CHAT_SPACE` (required)
- `GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL` (required)
- `GOOGLE_CHAT_SERVICE_ACCOUNT_PRIVATE_KEY` (required; keep newlines escaped as `\\n`)

### Recommended

- `APP_BASE_URL` (important for generating retry links)
- `CRON_SECRET` (protects `/reports/run`, `/reports/retry`, `/api/cron`)
- `REPORT_TIMEZONE` (highest priority)
- `TZ` (fallback timezone)
- `REPORT_DATE` (force specific report date, format `YYYY-MM-DD`)
- `REPORT_DEBUG`, `REPORT_DEBUG_AUTHORS`
- `API_BASE_PATH` (leave empty on Vercel unless needed)

## 5. Local Development

### Install

```bash
corepack enable
pnpm install
```

### Build

```bash
pnpm run build
```

### Run (dev mode)

```bash
pnpm run start:dev
```

Default URL: `http://localhost:3000`

## 6. API Endpoints

- `GET /` landing page
- `GET /health` health check
- `POST /reports/run` manual report trigger
- `GET /reports/retry` retry trigger (for button/open-link)
- `POST /reports/chat/events` Google Chat app callback

Important:

- `/reports/run` is `POST`. Opening it directly in browser (`GET`) returns `Cannot GET /reports/run`.
- If `CRON_SECRET` is set, pass token via `?token=...` or header `x-cron-secret`.

## 7. Quick Local Tests

Health:

```bash
curl http://localhost:3000/health
```

Manual run:

```bash
curl -X POST "http://localhost:3000/reports/run?token=YOUR_CRON_SECRET"
```

Retry:

```bash
curl "http://localhost:3000/reports/retry?token=YOUR_CRON_SECRET"
```

If you do not want token checks locally:

- Set `CRON_SECRET=` (empty) in `.env`, then restart the app.

## 8. Cron

### Nest Scheduler (non-Vercel)

Local scheduler runs with timezone `Asia/Ho_Chi_Minh`.

### Vercel Cron

Configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 10 * * 1-5"
    }
  ]
}
```

`0 10 * * 1-5` = 17:00 (GMT+7), Monday to Friday.

Manual test:

```bash
curl "https://<your-domain>/api/cron?token=YOUR_CRON_SECRET"
```

## 9. Deploy to Vercel

### Link project

```bash
pnpm dlx vercel login
pnpm dlx vercel link
```

### Set Production env vars

```bash
pnpm dlx vercel env add TEAM_NAME production
pnpm dlx vercel env add JIRA_DOMAIN production
pnpm dlx vercel env add JIRA_EMAIL production
pnpm dlx vercel env add JIRA_API_TOKEN production
pnpm dlx vercel env add GOOGLE_CHAT_MODE production
pnpm dlx vercel env add WEBHOOK production
pnpm dlx vercel env add APP_BASE_URL production
pnpm dlx vercel env add CRON_SECRET production
pnpm dlx vercel env add REPORT_TIMEZONE production
```

### Deploy

```bash
pnpm dlx vercel --prod --yes
```

Optional alias:

```bash
pnpm dlx vercel alias set <deployment-url> <your-domain>
```

## 10. Troubleshooting

### Retry button is missing

Common causes:

- `APP_BASE_URL` is missing or invalid.
- Running in `webhook` mode but retry URL cannot be generated.
- Deployment not refreshed after env changes.

### `/reports/retry` returns 500

Check:

- `TEAM_NAME` and `JIRA_DOMAIN` are set correctly.
- `JIRA_*` credentials are valid.
- `WEBHOOK` is valid.
- JQL project key (`TEAM_NAME`) and issue types are valid in Jira.

### `/reports/run` returns 404 in browser

It is expected if called with `GET`; this route is `POST`.

## 11. Security

- Never commit `.env` / `.env.local`.
- Do not print secrets in logs.
- Always enable `CRON_SECRET` in production.

## 12. Naming Convention

`TEAM_NAME` is used to replace hardcoded values like `BKM4` in:

- Google Chat report title
- Jira JQL project filter
- Team-related display/slug values

Example:

```dotenv
TEAM_NAME=ABC
```
