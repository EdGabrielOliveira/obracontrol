# ObraControl Monorepo

Workspace único para o backend e o frontend do ObraControl.

## Estrutura

- `apps/backend`: API Elysia, Prisma e testes do backend.
- `apps/frontend`: aplicação React/Vite e testes do frontend.

Os projetos originais continuam preservados em `../obracontrol-backend` e
`../obracontrol-frontend`.

## Requisitos

- Bun `1.3.14` ou compatível.
- Para Docker, copie `.env.example` para `.env` na raiz do monorepo. Os arquivos
  `apps/*/.env.example` são destinados à execução individual fora do Compose.

## Instalação

Na raiz deste monorepo:

```bash
bun install
```

O workspace usa `bun.lock` na raiz. Os `package-lock.json` dentro de cada app
são mantidos para os builds Docker Linux, que usam npm para resolver binários
nativos de forma compatível com o container.

## Desenvolvimento

Em terminais separados:

```bash
bun run dev:backend
bun run dev:frontend
```

Os comandos de validação também podem ser executados pela raiz:

```bash
bun run check
bun run typecheck
bun run test
bun run build:frontend
```

## Docker para desenvolvimento

Na raiz do monorepo:

```bash
cp .env.example .env
docker compose -f docker-compose.development.yml up -d --build
```

- Frontend: `http://localhost:7000`
- Backend: `http://localhost:7001`
- Banco: PostgreSQL persistido no volume Docker `obracontrol_postgres_data`
- Arquivos e anexos: volume Docker `obracontrol_api_data`

O Compose de desenvolvimento inicia o Vite e o backend em modo watch. Ele monta
`apps/frontend` e os diretórios editáveis de `apps/backend` no container; o
frontend usa polling para o Docker Desktop/Windows e o Bun reinicia a API ao
detectar mudanças no backend. Ele é destinado ao desenvolvimento e não deve ser
usado como stack de produção.

```bash
docker compose -f docker-compose.development.yml up -d --build
# ou: bun run dev:docker
```

O PostgreSQL local fica acessível somente em `127.0.0.1:5432` para ferramentas
do host; a API usa o hostname interno `postgres` da rede Docker.

## Deploy em VPS Linux

Na VPS, o `docker-compose.yml` padrão inclui o Compose de produção, que compila o frontend estático com Nginx,
mantém o backend apenas na rede interna do Compose e publica somente o frontend
em `127.0.0.1:7000`. Um Nginx, Caddy ou Apache instalado no host deve terminar
TLS e encaminhar o domínio para essa porta.

Para Nginx no host, há um modelo em
`ops/nginx/obracontrol.conf.example`; copie-o para `sites-available`, ajuste o
domínio e habilite o site antes de emitir o certificado TLS.

```bash
[ -f .env ] || cp .env.production.example .env
# edite .env: domínio público e segredos fortes
openssl rand -base64 48
docker compose config --quiet
bash ops/update-vps.sh
```

O fluxo equivalente manual é:

```bash
git pull --ff-only origin main
docker compose up -d --build
```

As atualizações usam exclusivamente PostgreSQL. O backend aplica automaticamente as migrations pendentes com
`prisma migrate deploy`.

O script `ops/update-vps.sh` automatiza o `git pull` e o deploy normal, exige
que a VPS esteja na branch `main` com working tree limpo e cria o backup antes
de subir os containers. Para reconstruir sem atualizar o Git, use
`bash ops/deploy.sh`.

Comandos de operação:

```bash
docker compose ps
docker compose logs -f --tail=200
bash ops/backup-postgres.sh
docker compose down
```

O deploy cria um snapshot do volume `obracontrol_api_data` e um dump lógico do
PostgreSQL antes de reconstruir as imagens. Copie os arquivos de `backups/` para
outro host ou storage regularmente. Nunca remova volumes durante uma
atualização: `docker compose down -v` apaga os dados.
