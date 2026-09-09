#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${COMPOSE_FILE:-$repo_dir/docker-compose.yml}"
backup_dir="${BACKUP_DIR:-$repo_dir/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/obracontrol-$timestamp.tar.gz"

umask 077
mkdir -p "$backup_dir"

backend_was_running=false
if docker compose -f "$compose_file" ps --services --filter status=running | grep -qx backend; then
	backend_was_running=true
fi

# SQLite e os anexos compartilham o mesmo volume. Parar apenas a API garante
# que o snapshot não capture um banco no meio de uma escrita.
docker compose -f "$compose_file" stop backend >/dev/null 2>&1 || true
restart_backend() {
	if [ "$backend_was_running" = true ]; then
		docker compose -f "$compose_file" start backend >/dev/null
	fi
}
trap restart_backend EXIT

docker run --rm \
	-v obracontrol_api_data:/data:ro \
	-v "$backup_dir:/backup" \
	alpine:3.22@sha256:14358309a308569c32bdc37e2e0e9694be33a9d99e68afb0f5ff33cc1f695dce \
	tar czf "/backup/$(basename "$backup_file")" -C /data .

echo "Backup criado: $backup_file"
