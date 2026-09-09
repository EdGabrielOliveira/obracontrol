#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${COMPOSE_FILE:-$repo_dir/docker-compose.yml}"

cd "$repo_dir"
docker compose -f "$compose_file" config --quiet

bash "$repo_dir/ops/backup-sqlite.sh"
bash "$repo_dir/ops/backup-postgres.sh"
docker compose -f "$compose_file" up -d --build --remove-orphans
docker compose -f "$compose_file" ps

echo "Deploy concluído. Consulte os logs com:"
echo "docker compose -f $compose_file logs -f --tail=200"
