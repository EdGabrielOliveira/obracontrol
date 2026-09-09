#!/bin/sh
set -eu

mkdir -p "${OBJECT_STORAGE_DIR:-/data/objects}"

# Aplica somente as migrations PostgreSQL ainda pendentes. Uma falha aborta o
# boot para que o proxy nao encaminhe trafego para um schema incompleto.
if [ "${RUN_DATABASE_MIGRATIONS:-true}" = "true" ]; then
	bunx --bun prisma migrate deploy
fi

# O backfill pertence ao mesmo deploy da migration de schema. Ele usa uma
# transacao unica e interrompe o boot se encontrar divergencias, preservando o
# banco para analise/restauracao do snapshot. Em bancos novos nao cria um
# workspace artificial: o primeiro cadastro administrativo cria o seu.
if [ "${WORKSPACE_BACKFILL_ON_BOOT:-true}" = "true" ]; then
	: "${WORKSPACE_MIGRATION_REPORT_PATH:=/data/workspace-migration-report.json}"
	bun /app/prisma/scripts/migrate-workspaces.ts \
		--apply \
		--out "$WORKSPACE_MIGRATION_REPORT_PATH"
fi

exec "$@"
