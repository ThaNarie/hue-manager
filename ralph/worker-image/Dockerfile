FROM node:22-bookworm

# Base tooling used by Cursor agent workflows.
RUN apt-get update && apt-get install -y --no-install-recommends \
  bash \
  ca-certificates \
  curl \
  git \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Enable package-manager shims used by modern JS projects.
RUN corepack enable

# Install GitHub CLI for issue/PR discovery in automated runs.
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# Install Cursor CLI once at image build time.
RUN curl https://cursor.com/install -fsS | bash
ENV PATH="/root/.local/bin:/root/.cursor/bin:${PATH}"

WORKDIR /workspace

# Ralph starts the actual command via `docker run ... sh -lc "<script>"`.
ENTRYPOINT ["sleep", "infinity"]
