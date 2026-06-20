# Contributing to Imanapharma

Thank you for your interest in contributing to Imanapharma. This repository is a monorepo for `cloud-api`, `edge-api`, `frontend`, and shared modules.

## How to contribute

1. Fork the repository.
2. Create a descriptive branch from `main`:
   - `fix/issue-name`
   - `feat/new-feature`
   - `chore/cleanup`
3. Make changes in the appropriate package:
   - `cloud-api/` for backend cloud services
   - `edge-api/` for branch edge services
   - `frontend/` for the web client
   - `shared/` for shared TypeScript rules and types
4. Run local checks and builds:
   - `cd cloud-api && npm ci && npm run build`
   - `cd edge-api && npm ci && npm run build`
   - `cd frontend && npm ci && npm run build`
5. Open a pull request with a clear title and summary.
6. Link related issues and describe testing performed.

## Code guidelines

- Keep changes focused and scoped to a single feature or bug.
- Prefer small commits with descriptive messages.
- Use consistent formatting and linting.
- Avoid committing generated files, build artifacts, or local environment files.

## Branch naming

- `feat/<feature-name>` for new functionality
- `fix/<bug-name>` for bug fixes
- `docs/<docs-update>` for documentation changes
- `chore/<task>` for maintenance tasks

## Pull request checklist

- [ ] I have forked the repository and created a branch.
- [ ] I have tested my changes locally.
- [ ] I have added or updated documentation if needed.
- [ ] My PR is focused and atomic.
- [ ] I have not added build artifacts or environment files.

## Reporting issues

Use issues for bugs, feature requests, or documentation fixes. Provide:

- A clear summary of the problem.
- Steps to reproduce.
- Expected and actual behavior.
- Environment details if relevant.

## Local setup tips

The repository includes a `docker-compose.yml` for local multi-service development.

For frontend development:

```bash
cd frontend
npm ci
npm run dev
```

For API development:

```bash
cd cloud-api
npm ci
npm run dev
```

```bash
cd edge-api
npm ci
npm run dev
```
