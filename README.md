# WanderPlan AI — Local / Self-hosted Quick Start

This repository includes a full self-hosted production stack driven by Docker Compose. The `docs/DEPLOYMENT.md` contains the full architecture and production notes; this README extracts the quick-start commands to open and run the project locally.

Prerequisites
- Docker Engine and Docker Compose (or Docker Desktop)
- Bash available in PATH (Git Bash, WSL, or similar) for running the setup script
- Recommended: 16+ GB RAM, 8+ CPU cores

Quick start

Open the project in VS Code:

```
code .
```

Run the setup script (from the workspace root). This generates `.env`, starts infra, and performs basic verification.

```
# make the script executable and run it (bash)
bash -lc "chmod +x infrastructure/scripts/setup.sh && infrastructure/scripts/setup.sh"
```

Edit the `.env` file (add at minimum an API key for Anthropic):

```
# edit .env with your preferred editor
code .env
# or
notepad .env
```

Restart agents to pick up updated environment variables:

```
# restart containers defined in the production compose file
docker compose -f infrastructure/production/docker-compose.prod.yml restart
```

Verify setup (the setup script supports a `--verify` flag):

```
bash -lc "infrastructure/scripts/setup.sh --verify"
```

Useful VS Code tasks (Run Tasks...):
- `Run setup.sh` — executes the `infrastructure/scripts/setup.sh` script (uses `bash`)
- `Start production stack` — runs `docker compose -f infrastructure/production/docker-compose.prod.yml up -d`
- `Stop production stack` — runs `docker compose -f infrastructure/production/docker-compose.prod.yml down`
- `Restart agents` — runs `docker compose -f infrastructure/production/docker-compose.prod.yml restart`

More
- See `docs/DEPLOYMENT.md` for architecture diagrams, CI/CD, monitoring, and backup/DR details.
- If you plan to run on Windows without WSL/Git Bash, open a WSL shell or Git Bash to run the setup script as-is.

If you'd like, I can:
- initialize a `package.json` or other project manifest
- add a `.env.example` derived from the setup script
- create workspace launch configs for debugging specific services
