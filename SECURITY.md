# Security Policy

## Supported Versions

The latest version on branch `main` is considered supported.

## Reporting a Vulnerability

Please report security vulnerabilities responsibly.

1. Do not create a public issue for sensitive vulnerabilities.
2. Use GitHub Security Advisories or contact maintainers privately.
3. Include reproduction steps, potential impact, and mitigation suggestions.

We will acknowledge reports as soon as possible and provide updates during triage and remediation.

## Secrets and Configuration

- Never commit `.env`, `.env.local`, or credentials.
- Rotate exposed credentials immediately.
- Keep `CRON_SECRET`, Jira tokens, and service account keys private.
