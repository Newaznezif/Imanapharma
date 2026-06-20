# Imanapharma

Monorepo for Imanapharma services (cloud-api, edge-api, frontend).

Quick start

Prerequisites: Docker, Git, GitHub account.

- Install deps per package (example for frontend):
  - `cd frontend && npm install && npm run dev`
- Or run all services with Docker Compose:
  - `docker-compose up --build`

Contributing

If you want to contribute to this project:

- Fork the repository and create a feature branch from `main`.
- Install each package locally and confirm it builds.
- Open a pull request with a clear title and description.
- Ensure changes are limited to `ImanaPharma` project files.

Development

This repository includes a `.devcontainer` configuration so you can start coding in GitHub Codespaces or VS Code Remote - Containers.

To open in Codespaces: open the repository on GitHub and click "Code" → "Open with Codespaces".

Deployment

This is a monorepo and the frontend app lives in `frontend/`. Deployments must build and publish the `frontend/dist` output.

- GitHub Pages: this repo includes a workflow that builds `frontend` and publishes `frontend/dist` to the `gh-pages` branch.
- Other hosts: set the publish directory to `frontend/dist`, and run `npm ci` plus `npm run build` from the `frontend/` folder.
- Do not publish the repository root as a static site; that will serve `README.md` instead of the app.

If you use GitHub CLI:

```
gh repo add-collaborator <username> --permission write
```

Notes

- Devcontainer forwards ports 3000 and 5173 for API and frontend development.
- Add a `LICENSE` file if you want an explicit project license.
