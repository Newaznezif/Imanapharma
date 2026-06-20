# Contributing to Imanapharma

Thank you for your interest in contributing to Imanapharma. This repository is a monorepo for `cloud-api`, `edge-api`, `frontend`, and shared modules.

## How to contribute

1. Fork the repository.
2. Create a descriptive branch from `main`:
   - `feat/<feature-name>`
   - `fix/<bug-name>`
   - `chore/<task>`
   - `docs/<docs-update>`
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

## What you can contribute

This project welcomes contributions in many areas. Here are at least 40 meaningful ways to help:

- Fix bugs in the `cloud-api` backend.
- Improve inventory sync logic in `edge-api`.
- Add frontend UI improvements and bug fixes.
- Create new safety validation rules in `shared/`.
- Improve database migration scripts.
- Add new unit tests for edge workflows.
- Add new unit tests for cloud APIs.
- Add end-to-end tests for the frontend.
- Improve Docker Compose service definitions.
- Harden API authentication and authorization.
- Improve GraphQL or REST contract documentation.
- Clean up technical debt in the monorepo structure.
- Add accessibility improvements to the frontend.
- Improve form validation and error handling.
- Optimize performance for API endpoints.
- Improve UI responsiveness and load behavior.
- Add more logging and observability.
- Update the `README.md` for setup accuracy.
- Add `CONTRIBUTING.md` guidance and examples.
- Add `SECURITY.md` guidance for responsible disclosure.
- Add issue templates for bugs and features.
- Add or improve pull request templates.
- Improve CI workflows and build automation.
- Add release notes or changelog guidance.
- Add local development scripts and commands.
- Improve package-level documentation.
- Add missing type definitions or interfaces.
- Improve error messages and user feedback.
- Add support for additional environments.
- Improve or add health checks for services.
- Add API contract tests.
- Improve database schema validation.
- Add rate-limiting and safety controls.
- Improve caching and data consistency.
- Add translation/localization support.
- Improve the frontend routing experience.
- Add validation to prevent unsafe inventory transfers.
- Improve onboarding documentation for developers.
- Add sample configuration files and examples.
- Improve code formatting and lint consistency.
- Add security improvements and vulnerability fixes.
- Add comments or architecture notes for maintainers.

## Code guidelines

- Keep changes focused and scoped to a single feature or bug.
- Prefer small commits with descriptive messages.
- Use consistent formatting and linting.
- Avoid committing generated files, build artifacts, or local environment files.
- Always run the relevant package build after changes.
- Update documentation when adding or changing behavior.
- Use existing code patterns whenever possible.
- Keep discovery and code review easy for maintainers.
- Prefer idiomatic TypeScript and JavaScript patterns.
- Keep tests passing for the packages you change.

## Branch naming

- `feat/<feature-name>` for new functionality
- `fix/<bug-name>` for bug fixes
- `docs/<docs-update>` for documentation changes
- `chore/<task>` for maintenance tasks
- `refactor/<area>` for refactors without behavior changes
- `test/<package>` for test improvements

## Commit message guidance

Use clear commit messages in the present tense. Example:

- `feat(frontend): add product search filter`
- `fix(cloud-api): resolve token refresh bug`
- `docs: update contribution guide`
- `chore: clean up Docker Compose services`

## Pull request checklist

- [ ] I have forked the repository and created a branch.
- [ ] I have described the problem and the solution.
- [ ] I have tested my changes locally.
- [ ] I have run builds for affected packages.
- [ ] I have updated documentation when needed.
- [ ] My PR is focused and atomic.
- [ ] I have not added generated files or build artifacts.
- [ ] I have included links to related issues.
- [ ] I have added screenshots or logs for UI or bug changes.

## Reporting issues

Use issues for bugs, feature requests, or documentation fixes. Provide:

- A clear summary of the problem.
- Steps to reproduce.
- Expected and actual behavior.
- Environment details if relevant.
- Any relevant logs, screenshots, or error output.

## Local setup tips

The repository includes a `docker-compose.yml` for local multi-service development.

For frontend development:

```bash
cd frontend
npm ci
npm run dev
```

For cloud API development:

```bash
cd cloud-api
npm ci
npm run dev
```

For edge API development:

```bash
cd edge-api
npm ci
npm run dev
```

## Extra help for contributors

- Ask questions in issues before making large architectural changes.
- Use the issue tracker to avoid duplicate work.
- Reference existing GitHub Actions when adding new CI jobs.
- Use the project’s shared folder for reusable types and rules.
- Keep the `frontend` build target separate from backend services.
- Respect the repository structure and package boundaries.
