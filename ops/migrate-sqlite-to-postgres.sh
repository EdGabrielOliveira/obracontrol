#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${COMPOSE_FILE:-$repo_dir/docker-compose.yml}"

cd "$repo_dir"
docker compose -f "$compose_file" config --quiet

echo "Criando snapshot do volume legado SQLite e dos anexos..."
bash "$repo_dir/ops/backup-sqlite.sh"

echo "Parando a aplicação para congelar novas escritas no SQLite..."
docker compose -f "$compose_file" stop frontend backend

echo "Iniciando PostgreSQL..."
docker compose -f "$compose_file" up -d postgres

echo "Aplicando schema e importando o SQLite legado..."
docker compose -f "$compose_file" --profile migration run --rm --build sqlite-import

echo "Subindo a aplicação já apontada para PostgreSQL..."
docker compose -f "$compose_file" up -d --build --remove-orphans

echo "Migração concluída. Valide a aplicação e mantenha o volume obracontrol_api_data preservado para os anexos/rollback."
