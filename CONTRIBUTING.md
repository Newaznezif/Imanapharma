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

## More contribution ideas (additional 40)

Here are more concrete and practical contribution tasks to help the project grow. Pick any item and open an issue before starting if you plan a large change.

1. Add Dependabot configuration for automated dependency updates.
2. Add a `CODEOWNERS` file to route PR reviews to maintainers.
3. Add a `LICENSE` (MIT or other) to clarify project terms.
4. Add automated security scanning in CI (e.g. npm audit, Snyk).
5. Add a badge for the CI status to the `README.md`.
6. Add a badge for code coverage to the `README.md`.
7. Add unit test coverage reporting (e.g. nyc / coverage)
8. Add a `prettier` config and formatting step in CI.
9. Add `eslint` rules and a lint job in CI for all packages.
10. Add a `lint-staged` + `husky` commit hook to run formatting before commit.
11. Add a CONTRIBUTOR recognition file or CONTRIBUTORS.md.
12. Add a CODE_OF_CONDUCT enforcement contact method.
13. Improve README with per-package quick start commands.
14. Add a `docs/` folder with architecture diagrams and ADRs.
15. Add an ADR (architecture decision record) for the sync protocol.
16. Add or improve API OpenAPI/Swagger specs for `cloud-api`.
17. Add a public changelog with `keep-a-changelog` guidelines.
18. Add a release automation workflow (GitHub Releases + changelog generation).
19. Add integration tests that exercise `cloud-api` <-> `edge-api` flows using containers.
20. Add e2e tests for the `frontend` using Playwright or Cypress.
21. Add a sample dataset and seed script for local development.
22. Add database schema migrations and versioning docs (e.g., node-pg-migrate).
23. Add typed SDKs or client helpers for the frontend to call `cloud-api`.
24. Add CI job matrix for Node versions if supporting multiple runtimes.
25. Add GitHub issue automation for stale issues and PR auto-labeling.
26. Add translation scaffolding for i18n in the frontend.
27. Add a performance benchmark suite for critical API endpoints.
28. Add a script to spin up the entire stack locally with one command.
29. Add a Helm chart or Kubernetes manifests for cloud deployment.
30. Add observability examples (OpenTelemetry, logs, metrics) to services.
31. Add a secrets-management guide and example env var configuration.
32. Add an onboarding checklist for new contributors in CONTRIBUTORS.md.
33. Add a maintenance schedule and tagging policy for releases.
34. Add input validation schemas (e.g., Joi / zod) for API payloads.
35. Add a pattern for feature flags and a simple toggle example.
36. Add a demo Docker Compose production-like profile with env examples.
37. Add a page describing the data model and key domain concepts.
38. Add an accessibility/a11y audit checklist for UI contributors.
39. Add code samples for common extension points (middleware, hooks).
40. Add an API client usage examples section to the frontend docs.

Feel free to pick any of these and open an issue referencing this list.
