# render-nest-api

NestJS web service to generate and send Jira worklog report to Google Chat, with auto-run schedule equivalent to your current project.

## Features

- Fetch Jira worklogs from `/rest/api/3/search/jql`
- Filter and aggregate by Vietnam date (`Asia/Ho_Chi_Minh`)
- Send text table report to Google Chat webhook
- Send Jira check button card to Chat
- Auto-run at 16:00 Monday to Friday (VN time) via Nest scheduler
- Dedicated cron runner for Render Cron Job service
- Manual trigger endpoint for testing

## Environment variables

Required:

- `JIRA_DOMAIN`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `WEBHOOK`

Optional:

- `TZ` (default: `Asia/Ho_Chi_Minh`)
- `REPORT_DATE` (format: `YYYY-MM-DD`)
- `CRON_SECRET` (protect manual trigger endpoint)

## Local run

```bash
npm install
npm run build
npm run start
```

Health check:

```bash
curl http://localhost:3000/health
```

Manual trigger:

```bash
curl -X POST "http://localhost:3000/reports/run?token=YOUR_CRON_SECRET"
```

## Deploy to Render

1. Create a new GitHub repo and push this folder content.
2. In Render, choose New -> Blueprint.
3. Connect your repo. Render will read `render.yaml` and create:
   - Web service
   - Cron service (schedule `0 9 * * 1-5` = 16:00 VN, Mon-Fri)
4. Set env vars for both services.

## Notes

- Cron in Render uses UTC expression; `0 9 * * 1-5` equals 16:00 VN weekdays.
- This project has both Nest internal cron and a Render cron service. Keep one or both depending on your reliability preference.
