# syntax=docker/dockerfile:1.7

# Build context: the monorepo root. npm is used only for deterministic Linux
# dependency installation; the application runtime remains Bun.
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS dependencies

WORKDIR /app

COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
	--mount=type=cache,target=/root/.npm,sharing=locked \
	apt-get update \
	&& apt-get install -y --no-install-recommends openssl \
	&& npm ci --ignore-scripts --include=optional --no-audit --no-fund

FROM dependencies AS prisma-build

COPY apps/backend/tsconfig.json apps/backend/prisma.config.ts ./
COPY apps/backend/prisma ./prisma

ENV DATABASE_URL=postgresql://obracontrol:build-only@localhost:5432/obracontrol?schema=public

RUN npx prisma generate

FROM prisma-build AS production-dependencies

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
	npm prune --omit=dev

RUN rm -rf \
		/app/node_modules/typescript

FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS production

WORKDIR /app

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=7001 \
	IMPORT_TMP_DIR=/tmp/obracontrol-imports \
	OBJECT_STORAGE_DIR=/data/objects \
	PYTHON_BIN=python3 \
	PDF_CONVERSION_TIMEOUT_SECONDS=45 \
	PDF_CONVERSION_QUEUE_LIMIT=2

ARG DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
	apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		fonts-dejavu-core \
		fonts-liberation \
		python3 \
		libreoffice-writer \
	&& rm -rf /usr/share/doc/libreoffice* /usr/share/libreoffice/share/gallery \
		/usr/share/libreoffice/share/template /var/lib/apt/lists/* /var/cache/apt/* \
	&& mkdir -p /tmp/obracontrol-imports /data/objects \
	&& chown -R bun:bun /tmp/obracontrol-imports /data

COPY --chown=bun:bun --from=production-dependencies /app/node_modules /app/node_modules
COPY --chown=bun:bun --from=prisma-build /app/generated /app/generated
COPY --chown=bun:bun --from=prisma-build /app/prisma/migrations-postgresql /app/prisma/migrations-postgresql
COPY --chown=bun:bun --from=prisma-build /app/prisma/schema.prisma /app/prisma/schema.prisma
COPY --chown=bun:bun --from=prisma-build /app/prisma/models /app/prisma/models
COPY --chown=bun:bun --from=prisma-build /app/prisma/scripts /app/prisma/scripts
COPY --chown=bun:bun apps/backend/prisma.config.ts /app/prisma.config.ts
COPY --chown=bun:bun apps/backend/prisma/seed.ts /app/prisma/seed.ts
COPY --chown=bun:bun apps/backend/src /app/src
COPY --chown=bun:bun apps/backend/scripts/convert-docx-to-pdf.py /app/scripts/convert-docx-to-pdf.py
COPY --chown=bun:bun apps/backend/scripts/docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod 755 /app/docker-entrypoint.sh

USER bun

EXPOSE 7001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD curl --fail --silent --show-error http://127.0.0.1:7001/health > /dev/null || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "src/index.ts"]
