#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${COMPOSE_FILE:-$repo_dir/docker-compose.yml}"
backup_dir="${BACKUP_DIR:-$repo_dir/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/obracontrol-postgres-$timestamp.dump"
temporary_file="$backup_file.tmp"

umask 077
mkdir -p "$backup_dir"
trap 'rm -f "$temporary_file"' EXIT

if ! docker compose -f "$compose_file" ps --services --filter status=running | grep -qx postgres; then
	echo "PostgreSQL ainda não está em execução; backup lógico ignorado."
	exit 0
fi

docker compose -f "$compose_file" exec -T postgres \
	sh -c 'pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
	> "$temporary_file"

test -s "$temporary_file"
mv "$temporary_file" "$backup_file"

echo "Backup PostgreSQL criado: $backup_file"
