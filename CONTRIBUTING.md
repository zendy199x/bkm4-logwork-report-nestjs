# Contributing

Thank you for your interest in contributing.

## Getting Started

1. Fork the repository.
1. Create a feature branch from `develop`.
1. Install dependencies:

```bash
pnpm install
```

1. Run checks before opening a pull request:

```bash
pnpm run test:coverage
pnpm run build
pnpm tsc -p tsconfig.spec.json --noEmit
```

## Pull Request Guidelines

- Keep changes focused and minimal.
- Add or update tests for behavior changes.
- Update documentation when endpoints, env vars, or deployment behavior changes.
- Use clear PR titles and descriptions.

## Pull Request Workflow

1. Fork this repository to your GitHub account.
1. Create a feature branch from `develop`.
1. Commit your changes and push to your fork.
1. Open a pull request with:
   - Base repository: `zendy199x/jira-team-work-log-tracking`
   - Base branch: `develop`
   - Compare branch: your fork feature branch
1. Fill in the PR template completely.
1. Ensure CI checks pass and address review feedback.

## Branch Policy

- Contributors must branch from `develop`.
- Pull requests must merge into `develop` first.
- Pull requests into `main` are only accepted from `develop`.
- `main` remains deployment branch for Vercel.

## What To Include In A PR

- Problem statement and scope.
- Summary of changes.
- Test evidence (commands and outputs).
- Any env var, endpoint, or deployment impact.

## Commit Message Guidelines

Prefer concise, descriptive messages, for example:

- `feat: add support for ...`
- `fix: handle ...`
- `docs: update ...`
- `test: cover ...`

## Code Style

- Follow existing TypeScript/NestJS patterns.
- Avoid hardcoding team-specific values.
- Keep secrets out of source code and logs.
