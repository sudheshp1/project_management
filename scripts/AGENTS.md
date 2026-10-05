# Script guide

These scripts start and stop the local Docker Compose application from the repository root.

- Windows: `start-windows.ps1` and `stop-windows.ps1`
- macOS: `start-macos.sh` and `stop-macos.sh`
- Linux: `start-linux.sh` and `stop-linux.sh`

Keep scripts small, fail fast, and use `docker compose` so all local services run consistently.