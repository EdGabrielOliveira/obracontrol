# syntax=docker/dockerfile:1.7

# Build context: the monorepo root.
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS frontend-dependencies

WORKDIR /app

COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
	npm ci --ignore-scripts --include=optional --no-audit --no-fund \
	&& ROLLUP_VERSION="$(node -p 'require("./node_modules/rollup/package.json").version')" \
	&& ESBUILD_VERSION="$(node -p 'require("./node_modules/esbuild/package.json").version')" \
	&& LIGHTNINGCSS_VERSION="$(node -p 'require("./node_modules/lightningcss/package.json").version')" \
	&& TAILWIND_OXIDE_VERSION="$(node -p 'require("./node_modules/@tailwindcss/oxide/package.json").version')" \
	&& npm install --ignore-scripts --no-save --no-audit --no-fund \
		"@rollup/rollup-linux-x64-gnu@${ROLLUP_VERSION}" \
		"@esbuild/linux-x64@${ESBUILD_VERSION}" \
		"lightningcss-linux-x64-gnu@${LIGHTNINGCSS_VERSION}" \
		"@tailwindcss/oxide-linux-x64-gnu@${TAILWIND_OXIDE_VERSION}"

FROM frontend-dependencies AS development

COPY --chown=node:node apps/frontend ./

RUN mkdir -p /app/node_modules/.vite \
	&& chown node:node /app /app/node_modules/.vite

USER node

EXPOSE 7000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:7000/').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM frontend-dependencies AS build

COPY apps/frontend ./

ARG VITE_SERVER_URL=
ARG VITE_SENTRY_DSN=
ENV VITE_SERVER_URL=${VITE_SERVER_URL} \
	VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

RUN npm run build

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 AS production

ENV API_UPSTREAM=http://backend:7001

COPY apps/frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

RUN sed -i 's|^pid .*|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf \
	&& mkdir -p /var/cache/nginx \
	&& chown -R nginx:nginx /var/cache/nginx /etc/nginx/conf.d /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8080/healthz | grep -q '"status":"ok"' || exit 1
