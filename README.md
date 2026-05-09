# Jira Team Work Log Tracking API

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE) [![Node 22.x](https://img.shields.io/badge/Node-22.x-339933?logo=node.js&logoColor=white)](package.json) [![pnpm 11](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)](package.json) [![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)

Open-source NestJS API for Jira team work log tracking, automated report generation, and Google Chat delivery.

If this project helps your team, consider giving it a star.

## Why This Project

- Track Jira work logs by team and report date with timezone-aware aggregation.
- Trigger reports manually or on schedule via Vercel cron.
- Deliver report cards to Google Chat in webhook mode or app mode.
- Keep architecture modular and easy to extend.

## Features

- Jira issue + worklog fetch with pagination support.
- Domain-oriented aggregation and value objects.
- Google Chat delivery:
  - Webhook mode.
  - App mode (service account).
- Trigger endpoints:
  - Manual run.
  - Retry flow.
  - Chat event callback.
- Health and help pages with environment-aware links.

## Tech Stack

- NestJS 11
- TypeScript
- Axios
- Jest (strict coverage)
- Vercel Serverless Functions + Vercel Cron

## Project Structure

```text
api/
----| _handler.ts
----| cron.ts
----| [...path].ts
----| reports/
----| ----| run.ts
----| ----| retry.ts
----| ----| chat/
----| ----| ----| events.ts
src/
----| app.module.ts
----| health.controller.ts
----| report/
----| ----| application/
----| ----| domain/
----| ----| infrastructure/
----| ----| report.controller.ts
----| ----| report.service.ts
----| ----| report.scheduler.ts
tests/
```

## Requirements

- Node.js: 22.x
- pnpm: 11.x

## Quick Start

1. Install dependencies:

```bash
corepack enable
pnpm install
```

1. Create local environment file:

```bash
cp .env.example .env
```

1. Start development server:

```bash
pnpm run start:dev
```

Local base URL:

```text
http://localhost:3000
```

## Environment Variables

Use .env.example as the source of truth.

### Required

- TEAM_NAME
- JIRA_DOMAIN
- JIRA_EMAIL
- JIRA_API_TOKEN
- CRON_SECRET (required for secure production triggering)

### Chat Configuration

GOOGLE_CHAT_MODE can be webhook or app.

If GOOGLE_CHAT_MODE=webhook:

- WEBHOOK (required)

If GOOGLE_CHAT_MODE=app:

- GOOGLE_CHAT_SPACE (required)
- GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL (required)
- GOOGLE_CHAT_SERVICE_ACCOUNT_PRIVATE_KEY (required)

### Optional

- APP_BASE_URL
- API_BASE_PATH
- REPORT_TIMEZONE
- TZ
- REPORT_DATE
- REPORT_DEBUG
- REPORT_DEBUG_AUTHORS

## API Endpoints

### Internal Nest routes

- GET /
- GET /health
- GET /help
- GET /readme (legacy alias to /help)
- POST /reports/run
- GET /reports/retry
- POST /reports/chat/events

### Public Vercel routes

The serverless handler maps /api/\* to Nest routes.

Examples:

- GET /api -> GET /
- GET /api/health -> GET /health
- GET /api/help -> GET /help
- POST /api/reports/run -> POST /reports/run
- GET /api/reports/retry -> GET /reports/retry
- POST /api/reports/chat/events -> POST /reports/chat/events

Dedicated cron endpoint:

- GET /api/cron

## Local Testing Commands

Health:

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

## Scripts

```bash
pnpm run build
pnpm run start
pnpm run start:dev
pnpm run test
pnpm run test:coverage
pnpm run test:ci
pnpm run ci:verify
pnpm run cron:run
pnpm run cron:dev
```

## Deploying to Vercel

1. Link project:

```bash
pnpm dlx vercel login
pnpm dlx vercel link
```

1. Configure Production environment variables in Vercel.

1. Deploy:

```bash
pnpm dlx vercel --prod --yes
```

Cron schedule is configured in vercel.json:

- path: /api/cron
- schedule: `0 10 * * 1-5`

## CI and Quality

Recommended pre-merge checks:

```bash
pnpm run test:coverage
pnpm run build
pnpm tsc -p tsconfig.spec.json --noEmit
```

## Troubleshooting

### 401 Invalid or missing cron secret

- Ensure CRON_SECRET is set correctly.
- Pass token via header/query as expected by the endpoint.

### 500 Function Invocation Failed on Vercel

- Check Vercel function logs first.
- Confirm production env vars are complete.
- Ensure current branch/deployment is the intended one.

### Timezone mismatch

- Set REPORT_TIMEZONE explicitly.
- Use REPORT_DATE for deterministic date checks.

## Security

- Never commit .env files or secrets.
- Rotate credentials if exposed.
- Keep service-account keys and API tokens private.

See SECURITY.md for disclosure guidance.

## Community

- Contributing guide: CONTRIBUTING.md
- Code of conduct: CODE_OF_CONDUCT.md
- Security policy: SECURITY.md
- PR template: .github/PULL_REQUEST_TEMPLATE.md

Contributions are welcome. Issues and pull requests are appreciated.

## License

MIT, see LICENSE.
