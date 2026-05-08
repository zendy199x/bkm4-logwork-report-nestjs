# bkm4-logwork-report-api

NestJS API to collect Jira worklogs and send a daily report to Google Chat.

## What this project does

- Fetches Jira worklogs via Jira Search API.
- Aggregates worklogs by report date/timezone.
- Sends report to Google Chat (webhook mode or app mode).
- Exposes manual endpoints for run/retry.
- Runs scheduled trigger on Vercel Cron.
- Provides a root HTML page with Vercel Web Analytics snippet.

## Architecture (Clean + Scalable)

The `report` module now follows a layered structure to keep responsibilities separated:

```text
src/report/
  application/
    report-runner.service.ts      # use-case orchestration
  domain/
    report.types.ts               # shared business contracts/types
  infrastructure/
    report-config.service.ts      # env parsing + runtime config
    jira-api.service.ts           # Jira API adapter
    chat-delivery.service.ts      # Google Chat adapter (webhook/app)
  report.service.ts               # facade for controller/scheduler compatibility
  report.controller.ts
  report.scheduler.ts
```

Design rules used in this project:

- Controller/scheduler should call a single facade (`ReportService`) and not know Jira/Chat details.
- `application` layer orchestrates use-cases only.
- `infrastructure` layer contains external I/O (Jira, Chat, env/runtime wiring).
- `domain` layer contains pure shared contracts.
- Keep env reads centralized in one place (`ReportConfigService`) to avoid config drift.

This structure makes it easier to add new integrations later (for example Slack, email, or a different issue tracker) without changing controller routes.

## Prerequisites

- Node.js 22.x
- pnpm 10.x
- Vercel account + Vercel CLI

Why Node 22?

- `package.json` is pinned to Node 22.x because this Vercel project runs on Node 22.
- If your local machine is Node 24, `pnpm run build` shows `Unsupported engine` warning.

Use Node 22 locally:

```bash
nvm use
node -v
```

This repository includes `.nvmrc` with `22` for quick switching.

## Environment variables

Required for all modes:

- `JIRA_DOMAIN`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_CHECK_URL`

Chat mode:

- `GOOGLE_CHAT_MODE=webhook` (default)
- `GOOGLE_CHAT_MODE=app`

Required when `GOOGLE_CHAT_MODE=webhook`:

- `WEBHOOK`

Required when `GOOGLE_CHAT_MODE=app`:

- `GOOGLE_CHAT_SPACE`
- `GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_CHAT_SERVICE_ACCOUNT_PRIVATE_KEY` (keep newline escaped as `\\n`)

Recommended optional vars:

- `REPORT_TIMEZONE=Asia/Ho_Chi_Minh`
- `TZ=Asia/Ho_Chi_Minh` (fallback)
- `REPORT_DATE=` (format `YYYY-MM-DD`)
- `APP_BASE_URL=https://bkm4-logwork-report.vercel.app`
- `CRON_SECRET=<long-random-secret>`
- `API_BASE_PATH=` (keep empty on Vercel unless you need custom prefix)

## Local development

1. Install deps

```bash
corepack enable
pnpm install
```

1. Build

```bash
pnpm run build
```

1. Run

```bash
pnpm run start
```

## How to test output quickly

Root HTML page (the one with analytics snippet):

```bash
curl -s http://localhost:3000/
```

You should see HTML containing:

- `BKM4 Logwork Report API`
- `/_vercel/insights/script.js`

Health endpoint:

```bash
curl http://localhost:3000/health
```

Manual run (local):

```bash
curl -X POST "http://localhost:3000/reports/run?token=YOUR_CRON_SECRET"
```

Retry endpoint (local):

```bash
curl "http://localhost:3000/reports/retry?token=YOUR_CRON_SECRET"
```

## Deploy to Vercel (step-by-step)

1. Login and link project

```bash
pnpm dlx vercel login
pnpm dlx vercel link
```

1. Set env vars (Production)

```bash
pnpm dlx vercel env add JIRA_DOMAIN production
pnpm dlx vercel env add JIRA_EMAIL production
pnpm dlx vercel env add JIRA_API_TOKEN production
pnpm dlx vercel env add JIRA_CHECK_URL production
pnpm dlx vercel env add GOOGLE_CHAT_MODE production
pnpm dlx vercel env add WEBHOOK production
pnpm dlx vercel env add APP_BASE_URL production
pnpm dlx vercel env add CRON_SECRET production
pnpm dlx vercel env add REPORT_TIMEZONE production
```

1. Deploy Production

```bash
pnpm dlx vercel --prod --yes
```

1. (Optional) point custom alias

```bash
pnpm dlx vercel alias set <deployment-url> bkm4-logwork-report.vercel.app
```

## Vercel Cron

Configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "15 10 * * 1-5"
    }
  ]
}
```

This means 17:15 Vietnam time on weekdays.

## Production endpoint tests (Vercel)

Health:

```bash
curl https://bkm4-logwork-report.vercel.app/api/health
```

Retry link (must include token):

```bash
curl "https://bkm4-logwork-report.vercel.app/api/reports/retry?token=YOUR_CRON_SECRET"
```

Cron route manually (for debugging):

```bash
curl "https://bkm4-logwork-report.vercel.app/api/cron?token=YOUR_CRON_SECRET"
```

Without token, `/api/cron` and retry endpoints are expected to return unauthorized.
