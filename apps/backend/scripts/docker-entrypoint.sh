#!/bin/sh
set -eu

mkdir -p "${OBJECT_STORAGE_DIR:-/data/objects}"

# Prepara o SQLite persistente e aplica somente migrations ainda não
# registradas. Incompatibilidades de schema abortam o boot sem alterar dados.
bun /app/scripts/prepare-sqlite-database.ts

exec "$@"
