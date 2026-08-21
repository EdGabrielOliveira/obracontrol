# syntax=docker/dockerfile:1.7

# Build context: the monorepo root.
FROM node:22-bookworm-slim AS development

WORKDIR /app

COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN npm install --ignore-scripts --include=optional --package-lock=false

COPY apps/frontend ./

EXPOSE 7000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN npm install --ignore-scripts --include=optional --package-lock=false

COPY apps/frontend ./

ARG VITE_SERVER_URL=
ARG VITE_SENTRY_DSN=
ENV VITE_SERVER_URL=${VITE_SERVER_URL} \
	VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

RUN npm run build

FROM nginx:1.27-alpine

ENV API_UPSTREAM=http://backend:7001

COPY apps/frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
	CMD wget -qO- http://127.0.0.1/healthz | grep -q '"status":"ok"' || exit 1
