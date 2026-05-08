---
description: "Use when editing report flows, environment configuration, health/readme pages, or deployment docs in this NestJS API project."
applyTo: "src/report/**, src/health.controller.ts, README.md, .env.example"
---

# Project Conventions

- Keep architecture clean and layered: application, domain, infrastructure.
- Avoid hardcoded team names. Use TEAM_NAME from env.
- Derive lowercase kebab-case slug from TEAM_NAME only when needed.
- Keep endpoint docs aligned with real methods and paths.
- Write README in English and keep setup/deploy/troubleshooting complete.
- Keep env validation centralized and explicit.
