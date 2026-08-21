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

## Docker

Na raiz do monorepo:

```bash
cp .env.example .env
# edite os segredos e as URLs públicas antes do primeiro deploy
docker compose up -d --build
```

- Frontend: `http://localhost:7000`
- Backend: `http://localhost:7001`
- Banco: SQLite persistido no volume Docker `obracontrol_api_data`

SQLite é um banco embutido em arquivo e não escuta uma porta TCP; por isso não
há um mapeamento `7711:7711` no Compose atual. Essa porta fica reservada para
uma futura migração para um banco cliente-servidor.
