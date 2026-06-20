# Imanapharma

Monorepo for Imanapharma services (cloud-api, edge-api, frontend).

Quick start

Prerequisites: Docker, Git, GitHub account.

- Install deps per package (example for frontend):
  - `cd frontend && npm install && npm run dev`
- Or run all services with Docker Compose:
  - `docker-compose up --build`

Codespaces

This repository includes a `.devcontainer` configuration so you can start coding in GitHub Codespaces or VS Code Remote - Containers.

To open in Codespaces: open the repository on GitHub and click "Code" → "Open with Codespaces".

Adding collaborators

To invite collaborators via the GitHub web UI go to Settings → Manage access → Invite teams or people. Alternatively, with the GitHub CLI:

```
gh repo add-collaborator Newaznezif --permission write
gh repo add-collaborator <username-or-email> --permission write
```

Notes

- Devcontainer forwards ports 3000 and 5173 for API and frontend development.
- Add a `LICENSE` file if you want an explicit project license.
