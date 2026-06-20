FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:18

# Install any additional OS packages here if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

USER vscode
