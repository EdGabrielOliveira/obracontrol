# syntax=docker/dockerfile:1.7

# Build context: the monorepo root. npm is used only for deterministic Linux
# dependency installation; the application runtime remains Bun.
FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

COPY apps/backend/package.json ./
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/* \
	&& npm install --ignore-scripts --include=optional --no-package-lock

FROM dependencies AS prisma-build

COPY apps/backend/tsconfig.json apps/backend/prisma.config.ts ./
COPY apps/backend/prisma ./prisma

RUN npx prisma generate \
	&& DATABASE_URL=file:./prisma/dev.db npx prisma db push --skip-generate

FROM prisma-build AS production-dependencies

RUN npm prune --omit=dev

FROM oven/bun:1.3.14-slim AS production

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive \
	NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=7001 \
	IMPORT_TMP_DIR=/tmp/obracontrol-imports \
	OBJECT_STORAGE_DIR=/data/objects

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		fonts-dejavu-core \
		fonts-liberation \
		libreoffice-writer \
	&& rm -rf /var/lib/apt/lists/* \
	&& mkdir -p /tmp/obracontrol-imports /data/objects \
	&& chown -R bun:bun /tmp/obracontrol-imports /data

COPY --chown=bun:bun --from=production-dependencies /app/node_modules /app/node_modules
COPY --chown=bun:bun --from=prisma-build /app/generated /app/generated
COPY --chown=bun:bun --from=prisma-build /app/prisma/dev.db /app/schema.db
COPY --chown=bun:bun --from=prisma-build /app/prisma/migrations /app/prisma/migrations
COPY --chown=bun:bun apps/backend/src /app/src
COPY --chown=bun:bun apps/backend/scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
COPY --chown=bun:bun apps/backend/scripts/prepare-sqlite-database.ts /app/scripts/prepare-sqlite-database.ts

RUN chmod 755 /app/docker-entrypoint.sh

USER bun

EXPOSE 7001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD curl --fail --silent --show-error http://127.0.0.1:7001/health > /dev/null || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "src/index.ts"]
