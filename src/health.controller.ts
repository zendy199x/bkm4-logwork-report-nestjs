import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class HealthController {
  private readonly teamName = (process.env.TEAM_NAME || 'BKM4').trim() || 'BKM4';
  private readonly apiBasePath = process.env.VERCEL ? '/api' : '';
  private readonly teamSlug =
    this.teamName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '') ||
    'team';

  private endpoint(pathname: string): string {
    const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
    if (normalized === '/') {
      return this.apiBasePath || '/';
    }

    return `${this.apiBasePath}${normalized}`;
  }

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  home(): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${this.teamName} Work Log Report API</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%233558e6'/%3E%3Ctext x='50%25' y='52%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='28' fill='white'%3EB%3C/text%3E%3C/svg%3E" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --bg-top: #fff6ee;
        --bg-bottom: #eaf4ff;
        --ink: #1f2940;
        --muted: #596785;
        --line: #dbe2f1;
        --card: rgba(255, 255, 255, 0.82);
        --get: #0f8b8d;
        --post: #3558e6;
        --secure: #b83280;
        --accent: #ff7f50;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: 'Space Grotesk', sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 8% 12%, rgba(255, 170, 123, 0.35), transparent 34%),
          radial-gradient(circle at 90% 8%, rgba(104, 196, 255, 0.28), transparent 30%),
          radial-gradient(circle at 92% 80%, rgba(121, 171, 255, 0.20), transparent 32%),
          linear-gradient(180deg, var(--bg-top), var(--bg-bottom));
      }

      .container {
        max-width: 1040px;
        margin: 36px auto;
        padding: 0 18px;
      }

      .card {
        background: var(--card);
        backdrop-filter: blur(9px);
        border: 1px solid rgba(255, 255, 255, 0.9);
        border-radius: 22px;
        padding: 30px;
        box-shadow:
          0 24px 45px rgba(35, 67, 124, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }

      h1 {
        margin: 0 0 10px;
        font-size: clamp(32px, 4.7vw, 62px);
        line-height: 1.02;
        letter-spacing: -0.03em;
        text-wrap: balance;
      }

      h2 {
        margin: 20px 0 8px;
        font-size: clamp(22px, 2.8vw, 30px);
      }

      p {
        margin: 8px 0;
        color: var(--muted);
        font-size: 16px;
      }

      a {
        color: #204dd7;
        text-decoration-thickness: 2px;
        text-underline-offset: 2px;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 14px;
        margin: 20px 0 24px;
      }

      .stat {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 14px;
        background: linear-gradient(160deg, rgba(255, 255, 255, 0.9), rgba(247, 250, 255, 0.65));
      }

      .stat .label {
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .stat .value {
        margin-top: 7px;
        font-size: 28px;
        font-weight: 700;
        color: #1b2a48;
      }

      .table-wrap {
        overflow-x: auto;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.92);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      th,
      td {
        border-bottom: 1px solid var(--line);
        padding: 11px 10px;
        text-align: left;
        vertical-align: top;
      }

      th {
        color: #24344e;
        background: linear-gradient(180deg, #f8faff, #eef4ff);
        font-weight: 700;
      }

      .chip {
        display: inline-block;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 700;
        color: #fff;
        box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.24);
      }

      .get { background: var(--get); }
      .post { background: var(--post); }
      .secure {
        color: var(--secure);
        font-weight: 700;
      }

      code {
        background: #eff4ff;
        border-radius: 6px;
        padding: 2px 7px;
        color: #22345d;
      }

      .footer-note {
        margin-top: 14px;
        font-size: 13px;
        color: #60708c;
      }

      .subtle {
        color: #5f6f8c;
        margin: 6px 0 10px;
        font-size: 14px;
      }

      .env-chip {
        display: inline-block;
        border-radius: 999px;
        padding: 3px 9px;
        font-size: 11px;
        font-weight: 700;
      }

      .required {
        color: #8a2323;
        background: #fdebec;
      }

      .optional {
        color: #28569f;
        background: #ebf2ff;
      }

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
      }

      .footer-note code {
        background: #fff3e6;
        color: #aa4c20;
      }

      @media (max-width: 640px) {
        .card {
          padding: 18px;
        }

        th,
        td {
          padding: 9px 8px;
          font-size: 13px;
        }
      }
    </style>
  </head>
  <body>
    <main class="container">
      <section class="card">
        <h1>${this.teamName} Work Log Report API</h1>
        <p>Service is running.</p>
        <p>Health check: <a href="${this.endpoint('/health')}">${this.endpoint('/health')}</a></p>
        <p>Full guide: <a href="${this.endpoint('/help')}">${this.endpoint('/help')}</a></p>

        <div class="stats">
          <div class="stat">
            <div class="label">Total Endpoints</div>
            <div class="value">5</div>
          </div>
          <div class="stat">
            <div class="label">GET</div>
            <div class="value">3</div>
          </div>
          <div class="stat">
            <div class="label">POST</div>
            <div class="value">2</div>
          </div>
          <div class="stat">
            <div class="label">Secured</div>
            <div class="value">2</div>
          </div>
        </div>

        <h2>API Catalog</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Auth</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="chip get">GET</span></td>
                <td><code>${this.endpoint('/')}</code></td>
                <td>Public</td>
                <td>Landing page with service overview and endpoint index.</td>
              </tr>
              <tr>
                <td><span class="chip get">GET</span></td>
                <td><code>${this.endpoint('/health')}</code></td>
                <td>Public</td>
                <td>Health probe returning service metadata and server time.</td>
              </tr>
              <tr>
                <td><span class="chip post">POST</span></td>
                <td><code>${this.endpoint('/reports/run')}</code></td>
                <td><span class="secure">x-cron-secret</span> or <span class="secure">?token=</span></td>
                <td>Trigger report generation manually from trusted callers.</td>
              </tr>
              <tr>
                <td><span class="chip get">GET</span></td>
                <td><code>${this.endpoint('/reports/retry')}</code></td>
                <td><span class="secure">?token=</span></td>
                <td>Retry the report flow from Chat action/open-link callback.</td>
              </tr>
              <tr>
                <td><span class="chip post">POST</span></td>
                <td><code>${this.endpoint('/reports/chat/events')}</code></td>
                <td>Google Chat callback</td>
                <td>Receive and process inbound Google Chat app events.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="footer-note">Tip: secure endpoints require <code>CRON_SECRET</code> when configured.</p>

        <h2>ENV Catalog</h2>
        <p class="subtle">Operational environment variables used by this service.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Variable</th>
                <th>Required</th>
                <th>Example</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>JIRA_DOMAIN</code></td>
                <td><span class="env-chip required">Required</span></td>
                <td class="mono">https://oneline.atlassian.net</td>
                <td>Base URL for Jira API requests.</td>
              </tr>
              <tr>
                <td><code>JIRA_EMAIL</code></td>
                <td><span class="env-chip required">Required</span></td>
                <td class="mono">bot@company.com</td>
                <td>Jira account used for API auth.</td>
              </tr>
              <tr>
                <td><code>JIRA_API_TOKEN</code></td>
                <td><span class="env-chip required">Required</span></td>
                <td class="mono">ATATT... (token)</td>
                <td>Jira API token for basic authentication.</td>
              </tr>
              <tr>
                <td><code>TEAM_NAME</code></td>
                <td><span class="env-chip required">Required</span></td>
                <td class="mono">${this.teamName}</td>
                <td>Jira project key used to build JQL and Jira check button URL.</td>
              </tr>
              <tr>
                <td><code>GOOGLE_CHAT_MODE</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">webhook | app</td>
                <td>Choose Chat delivery mode (default: webhook).</td>
              </tr>
              <tr>
                <td><code>WEBHOOK</code></td>
                <td><span class="env-chip required">Required</span></td>
                <td class="mono">https://chat.googleapis.com/v1/...</td>
                <td>Google Chat incoming webhook URL (webhook mode).</td>
              </tr>
              <tr>
                <td><code>GOOGLE_CHAT_SPACE</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">spaces/AAAA12345</td>
                <td>Target space when using Chat app mode.</td>
              </tr>
              <tr>
                <td><code>GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">service-account@project.iam.gserviceaccount.com</td>
                <td>Service account identity for Chat app mode.</td>
              </tr>
              <tr>
                <td><code>GOOGLE_CHAT_SERVICE_ACCOUNT_PRIVATE_KEY</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">-----BEGIN PRIVATE KEY-----...</td>
                <td>Private key for JWT access token (Chat app mode).</td>
              </tr>
              <tr>
                <td><code>CRON_SECRET</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">7f3c9f...</td>
                <td>Protect <code>/reports/run</code> and <code>/reports/retry</code>.</td>
              </tr>
              <tr>
                <td><code>REPORT_TIMEZONE</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">Asia/Ho_Chi_Minh</td>
                <td>Primary timezone used for report date filtering.</td>
              </tr>
              <tr>
                <td><code>TZ</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">Asia/Ho_Chi_Minh</td>
                <td>Fallback timezone if <code>REPORT_TIMEZONE</code> is empty.</td>
              </tr>
              <tr>
                <td><code>REPORT_DATE</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">2026-05-08</td>
                <td>Force report for a specific date (YYYY-MM-DD).</td>
              </tr>
              <tr>
                <td><code>APP_BASE_URL</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">https://${this.teamSlug}-logwork-report.vercel.app</td>
                <td>Used to build retry link for Chat cards.</td>
              </tr>
              <tr>
                <td><code>API_BASE_PATH</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">/api</td>
                <td>Optional API prefix for retry URL generation.</td>
              </tr>
              <tr>
                <td><code>REPORT_DEBUG</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">true</td>
                <td>Enable detailed work log aggregation logs.</td>
              </tr>
              <tr>
                <td><code>REPORT_DEBUG_AUTHORS</code></td>
                <td><span class="env-chip optional">Optional</span></td>
                <td class="mono">Tyler,Leser</td>
                <td>Filter debug logs for specific authors only.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="footer-note">Never expose production secrets in client-side code or logs.</p>
      </section>
    </main>
  </body>
</html>`;
  }

  @Get('help')
  @Get('readme')
  @Header('Content-Type', 'text/html; charset=utf-8')
  help(): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${this.teamName} Work Log Report - Setup Guide</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%233558e6'/%3E%3Ctext x='50%25' y='52%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='28' fill='white'%3EB%3C/text%3E%3C/svg%3E" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --bg-a: #fff6ee;
        --bg-b: #eaf4ff;
        --ink: #1f2940;
        --muted: #596785;
        --line: #dbe2f1;
        --card: rgba(255, 255, 255, 0.86);
        --accent: #3558e6;
        --ok: #0f8b8d;
        --warn: #a75817;
        --soft-indigo: #edf2ff;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: 'Space Grotesk', sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 8% 10%, rgba(255, 170, 123, 0.35), transparent 34%),
          radial-gradient(circle at 90% 8%, rgba(104, 196, 255, 0.28), transparent 30%),
          radial-gradient(circle at 92% 80%, rgba(121, 171, 255, 0.20), transparent 32%),
          linear-gradient(180deg, var(--bg-a), var(--bg-b));
      }

      .wrap {
        max-width: 1060px;
        margin: 36px auto;
        padding: 0 18px 28px;
      }

      .hero,
      .card {
        background: var(--card);
        border: 1px solid rgba(255, 255, 255, 0.9);
        border-radius: 22px;
        box-shadow: 0 24px 45px rgba(35, 67, 124, 0.14);
        backdrop-filter: blur(9px);
      }

      .hero {
        padding: 30px;
        margin-bottom: 14px;
      }

      .hero h1 {
        margin: 0 0 10px;
        font-size: clamp(32px, 4.7vw, 60px);
        line-height: 1.02;
        letter-spacing: -0.03em;
        text-wrap: balance;
      }

      .hero p {
        margin: 8px 0;
        color: var(--muted);
        font-size: 16px;
      }

      .hero-links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
      }

      .pill {
        display: inline-block;
        border-radius: 999px;
        padding: 7px 13px;
        font-size: 13px;
        text-decoration: none;
        border: 1px solid var(--line);
        background: #fff;
        color: #27427e;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin: 14px 0 0;
      }

      .stat {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 12px;
        background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(247, 250, 255, 0.68));
      }

      .stat .label {
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .stat .value {
        margin-top: 6px;
        font-size: 26px;
        font-weight: 700;
        color: #1b2a48;
      }

      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .card {
        padding: 22px;
      }

      h2 {
        margin: 0 0 10px;
        font-size: 25px;
      }

      h3 {
        margin: 0 0 8px;
        font-size: 20px;
      }

      p, li {
        font-size: 15px;
        color: var(--muted);
      }

      .step-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .step-no {
        width: 30px;
        height: 30px;
        border-radius: 999px;
        display: inline-grid;
        place-items: center;
        font-size: 13px;
        font-weight: 700;
        color: #fff;
        background: var(--accent);
        box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.25);
      }

      .full {
        grid-column: 1 / -1;
      }

      ol,
      ul {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 6px;
      }

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
        background: var(--soft-indigo);
        border-radius: 6px;
        padding: 2px 7px;
        color: #23355e;
      }

      pre {
        margin: 10px 0 0;
        padding: 14px;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: #f8fbff;
        overflow-x: auto;
        color: #21365f;
        font-size: 13px;
      }

      .callout {
        margin-top: 10px;
        border-radius: 10px;
        padding: 12px 14px;
        border: 1px solid #f2d8bf;
        background: #fff5ea;
        color: var(--warn);
        font-size: 14px;
      }

      .ok {
        border: 1px solid #b9e7df;
        background: #ecfbf8;
        color: var(--ok);
      }

      .table-wrap {
        overflow-x: auto;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.92);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      th,
      td {
        border-bottom: 1px solid var(--line);
        padding: 11px 10px;
        text-align: left;
        vertical-align: top;
      }

      th {
        color: #24344e;
        background: linear-gradient(180deg, #f8faff, #eef4ff);
        font-weight: 700;
      }

      @media (max-width: 640px) {
        .hero,
        .card {
          padding: 16px;
        }

        h2 {
          font-size: 22px;
        }

        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <h1>Setup & Deploy Guide</h1>
        <p>This page documents end-to-end setup for local development and Vercel production deployment.</p>
        <div class="hero-links">
          <a class="pill" href="${this.endpoint('/')}">Home</a>
          <a class="pill" href="${this.endpoint('/health')}">Health</a>
          <a class="pill" href="${this.endpoint('/help')}">Refresh Guide</a>
        </div>
        <div class="stats">
          <div class="stat">
            <div class="label">Guide Steps</div>
            <div class="value">7</div>
          </div>
          <div class="stat">
            <div class="label">Main Branch</div>
            <div class="value">vercel-deploy</div>
          </div>
          <div class="stat">
            <div class="label">Target Domain</div>
            <div class="value">${this.teamSlug}-logwork-report.vercel.app</div>
          </div>
          <div class="stat">
            <div class="label">Auth Mode</div>
            <div class="value">Public (off)</div>
          </div>
        </div>
      </section>

      <section class="grid">
        <article class="card">
          <div class="step-head"><span class="step-no">1</span><h2>Local Setup</h2></div>
          <ol>
            <li>Use Node.js <code>22.x</code> (same as Vercel runtime setting).</li>
            <li>Install dependencies.</li>
            <li>Create <code>.env</code> with Jira + Chat credentials.</li>
            <li>Run app and open <code>http://localhost:3000</code>.</li>
          </ol>
          <pre>pnpm install
pnpm run build
pnpm run start:dev</pre>
        </article>

        <article class="card">
          <div class="step-head"><span class="step-no">2</span><h2>Required Environment Variables</h2></div>
          <ul>
            <li><code>TEAM_NAME</code> - Jira project key used in report logic.</li>
            <li><code>JIRA_DOMAIN</code> - Jira base domain.</li>
            <li><code>JIRA_EMAIL</code> - Jira account email.</li>
            <li><code>JIRA_API_TOKEN</code> - Jira API token.</li>
            <li><code>WEBHOOK</code> - Google Chat incoming webhook URL (when <code>GOOGLE_CHAT_MODE=webhook</code>).</li>
          </ul>
          <p>Optional but recommended: <code>CRON_SECRET</code>, <code>REPORT_TIMEZONE</code>, <code>APP_BASE_URL</code>.</p>
        </article>

        <article class="card">
          <div class="step-head"><span class="step-no">3</span><h2>Deploy To Vercel</h2></div>
          <ol>
            <li>Push code to branch <code>vercel-deploy</code>.</li>
            <li>Deploy production from that branch.</li>
            <li>Attach production alias/domain.</li>
          </ol>
          <pre>git checkout vercel-deploy
git pull --ff-only origin vercel-deploy
npx -y vercel deploy --prod --yes
npx -y vercel alias set &lt;deployment-url&gt; ${this.teamSlug}-logwork-report.vercel.app</pre>
          <div class="callout ok">Recommended: keep production domain as <code>${this.teamSlug}-logwork-report.vercel.app</code>.</div>
        </article>

        <article class="card">
          <div class="step-head"><span class="step-no">4</span><h2>Set Environment Variables On Vercel</h2></div>
          <ol>
            <li>Project - Settings - Environment Variables.</li>
            <li>Add variables for <strong>Production</strong> scope.</li>
            <li>Redeploy after changes.</li>
          </ol>
          <pre>npx -y vercel env add CRON_SECRET production
        npx -y vercel env add TEAM_NAME production
npx -y vercel env add JIRA_DOMAIN production
npx -y vercel env add JIRA_EMAIL production
npx -y vercel env add JIRA_API_TOKEN production
npx -y vercel env add WEBHOOK production</pre>
        </article>

        <article class="card">
          <div class="step-head"><span class="step-no">5</span><h2>Set Main Deploy Branch To vercel-deploy</h2></div>
          <ol>
            <li>Go to GitHub repo settings.</li>
            <li>Open <code>Settings - Branches</code>.</li>
            <li>Change <code>Default branch</code> to <code>vercel-deploy</code>.</li>
          </ol>
          <p>Vercel production follows your repository default branch when Production Branch selector is not available in project settings.</p>
        </article>

        <article class="card">
          <div class="step-head"><span class="step-no">6</span><h2>Turn Off Vercel Authentication (Make Site Public)</h2></div>
          <p>If you see this message: <code>Visitors must be logged in to Vercel and a member of your team to view your deployments</code>, disable deployment protection:</p>
          <ol>
            <li>Open Vercel Project - <code>Settings - Deployment Protection</code>.</li>
            <li>Find <code>Vercel Authentication</code>.</li>
            <li>Disable protection for <code>Production</code> (and <code>Preview</code> if needed).</li>
            <li>Save settings and redeploy.</li>
          </ol>
          <div class="callout">Warning: turning this off makes deployments publicly accessible. Do not expose secret values in any HTML/API response.</div>
        </article>

        <article class="card full">
          <div class="step-head"><span class="step-no">7</span><h2>Verify Production</h2></div>
          <ol>
            <li>Open <code>${this.endpoint('/health')}</code> and confirm <code>ok: true</code>.</li>
            <li>Trigger <code>${this.endpoint('/reports/run')}</code> using <code>x-cron-secret</code> or <code>?token=</code>.</li>
            <li>Check Google Chat receives report + action buttons.</li>
          </ol>
          <pre>curl -X POST "https://${this.teamSlug}-logwork-report.vercel.app/api/reports/run?token=YOUR_CRON_SECRET"</pre>
        </article>

        <article class="card full">
          <h2>Quick Deployment Checklist</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Where</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Branch for production is <code>vercel-deploy</code></td>
                  <td>Required</td>
                  <td>GitHub - Settings - Branches</td>
                </tr>
                <tr>
                  <td>Production domain alias attached</td>
                  <td>Required</td>
                  <td>Vercel - Domains / Alias</td>
                </tr>
                <tr>
                  <td>All production ENV variables set</td>
                  <td>Required</td>
                  <td>Vercel - Environment Variables</td>
                </tr>
                <tr>
                  <td>Vercel Authentication disabled (if public site expected)</td>
                  <td>Optional</td>
                  <td>Vercel - Deployment Protection</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  </body>
</html>`;
  }

  readme(): string {
    return this.help();
  }

  @Get('health')
  health() {
    return {
      ok: true,
      service: `${this.teamSlug}-logwork-report-api`,
      now: new Date().toISOString(),
    };
  }
}
