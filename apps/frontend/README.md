# ObraControl Frontend

Aplicação web do ObraControl para planejamento, acompanhamento e gestão de obras. O frontend organiza a navegação, coleta entradas, consulta a API oficial e apresenta orçamento, cronograma, medições, contratos, custos, relatórios e indicadores de BI.

## Responsabilidades

O frontend é responsável por:

- navegação, layouts, filtros e estados de tela;
- formulários, validações de entrada e feedback ao usuário;
- consumo tipado da API backend;
- cache e invalidação do server state;
- tabelas, gráficos, relatórios e exportações;
- apresentação de qualidade dos dados, pendências e permissões.

O frontend não é responsável por persistência, autorização real, travas de governança ou recálculo de PV, EV, AC, SPI/IDP, CPI/IDC, saldo, Curva S e métricas financeiras. O backend é a fonte oficial desses resultados.

## Stack

- React 19 + TypeScript;
- Vite;
- TanStack Router;
- TanStack Query;
- Axios;
- Zod + React Hook Form;
- Tailwind CSS, Radix UI e componentes próprios;
- Recharts para gráficos;
- Playwright para E2E e Biome para lint/format/check.

## Desenvolvimento local

Pré-requisitos: Node/Bun, backend disponível e variáveis configuradas.

```bash
bun install
bun run dev
```

A aplicação inicia em `http://localhost:7000`.

Variáveis principais em `.env` ou `.env.local`:

```dotenv
VITE_SERVER_URL=
VITE_SENTRY_DSN=
```

`VITE_SERVER_URL` vazio mantém as chamadas same-origin (o Vite encaminha a API
ao backend local). Preencha somente quando a API estiver em origem pública
separada.

O backend local fica em `../backend`.

### Docker Compose local

Com o backend iniciado na porta `7001`, execute o Compose pela raiz do monorepo:

```powershell
docker compose -f docker-compose.yml up -d --build
```

Acesse `http://localhost:7000`. Para usar outra porta ou outro backend:

```powershell
$env:WEB_PORT="8080"
$env:BACKEND_URL="http://host.docker.internal:7001"
docker compose -f docker-compose.yml up -d --build
```

O backend e o frontend sobem juntos com o Compose da raiz. O banco atual é
SQLite persistido no volume `obracontrol_api_data`; ele não possui porta TCP.

O Compose da raiz roda o frontend pelo Vite dentro do Docker, com hot reload
para arquivos do workspace:

```powershell
bun run dev:docker
```

Esse modo expõe o Vite na porta `7000`, encaminha a API para o serviço
`backend` e ativa polling de arquivos para compatibilidade com Docker Desktop.

Em produção, o frontend é publicado via Docker no Dokploy; o Nginx encaminha
as rotas da API para o backend `obracontrol-api` na mesma rede. O backend usa
SQLite em volume; não há origem Prisma ou banco externo configurado no
frontend.

## Acesso externo temporario com ngrok

Use este fluxo somente para testes controlados. O Vite encaminha as chamadas da
API ao backend local, portanto apenas a porta `7000` precisa de um tunel.

1. Inicie o ngrok e copie a URL HTTPS exibida:

```powershell
ngrok http 7000
```

2. Em outro terminal, gere o build e sirva a versao compactada, autorizando
   somente o hostname recebido:

```powershell
$env:__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="SEU_HOST.ngrok-free.app"
bun run build
bun run serve
```

3. Reinicie o backend Docker com a origem publica confiavel:

```powershell
$env:FRONTEND_ORIGIN="https://SEU_HOST.ngrok-free.app"
docker compose -f ..\obracontrol-backend\docker-compose.yml up -d --force-recreate --no-deps backend
```

Compartilhe apenas a URL HTTPS. Ao abrir pela primeira vez, o plano gratuito do
ngrok pode mostrar uma tela de confirmacao antes de carregar a aplicacao. A URL
deixa de funcionar quando o processo do ngrok e encerrado.

## Comandos

```bash
bun run dev       # servidor Vite
bun run build     # build de produção
bun run serve     # serve do build
bun run typecheck # TypeScript
bun run check     # Biome
bun run format    # formata arquivos
bun run e2e       # Playwright
bun run e2e:ui    # Playwright interativo
```

Os testes E2E ficam em [`tests/e2e`](./tests/e2e), organizados por jornada em
`auth/` e `critical-flows/`, com helpers compartilhados em `support/`.

## Estrutura do projeto

```text
src/
├── routes/                 # rotas TanStack e orquestração das telas
├── api/                    # cliente HTTP, APIs de domínio e query keys
├── schemas/               # schemas Zod de filtros e formulários
├── types/                 # DTOs e modelos de apresentação
├── components/ui/         # primitivas visuais
├── components/atoms/      # elementos básicos e estados comuns
├── components/molecules/  # composições reutilizáveis
├── components/organisms/  # blocos de domínio e telas
├── lib/                   # auth, query client, downloads e invalidação
├── hooks/                 # hooks de interação e responsividade
└── utils/                 # formatação, árvore, paginação e apoio de UI
```

Os principais domínios são organizações, centros de custo, obras, orçamento, cronograma, medições, contratos, custos, relatórios, auditoria, usuários, API keys e BI.

Hierarquia funcional:

```text
Organização → Centro de Custo → Obra → Orçamento
                                      ├── Cronograma
                                      ├── Medições
                                      ├── Contratos/Fornecedores
                                      ├── Custos/Pagamentos
                                      └── BI/Relatórios
```

## Fluxo de dados

```text
Rota TanStack
  → schema de busca + loader/prefetch
  → API de domínio (Axios)
  → backend
  → TanStack Query
  → route component
  → organism/table/chart
```

Mutations pertencem à rota ou a um fluxo de formulário claramente definido. Após salvar, importar, aceitar, reabrir, travar ou excluir, a rota deve invalidar as query keys canônicas e atualizar a fotografia visível.

## Padrão de rotas

Uma rota que carrega dados deve usar, conforme aplicável:

1. `head` com título e metadados;
2. `validateSearch` com schema Zod;
3. `loaderDeps` para filtros e paginação;
4. `loader` com `queryClient.prefetchQuery`;
5. `useQuery` com a mesma factory de query key;
6. estados de loading, erro, vazio e conteúdo;
7. mutations, toast, invalidação e navegação coerentes com o domínio.

Consultas GET primárias devem ser orquestradas pela rota. Organisms podem receber dados por props e manter consultas secundárias locais quando isso for justificado, mas não devem duplicar a consulta principal da página.

## API, tipos e cache

As APIs de domínio ficam em `src/api/`, incluindo:

- `budget.ts`, `schedule.ts` e `works.ts`;
- `work-measurements.ts`, `contract-measurements.ts` e `contract-payments.ts`;
- `contracts.ts`, `contract-services.ts` e `contract-files.ts`;
- `costs.ts`, `reports.ts`, `export.ts`, `import.ts` e `templates.ts`;
- `bi.ts`, `management.ts`, `organizations.ts`, `audit.ts`, `admin-users.ts` e `api-keys.ts`.

Regras:

- query keys devem usar factories de `src/api/query-keys.ts`;
- filtros de URL devem ser validados e sanitizados antes do request;
- respostas devem usar DTOs tipados e refletir `null`, enums e estados de disponibilidade;
- erros backend com `errors[]` devem ser exibidos por campo quando possível;
- respostas paginadas devem manter `data`, `total`, `page`, `limit`, `totalPages`, `hasNextPage` e `hasPreviousPage`;
- não usar casts ou `Record<string, unknown>` para esconder divergências de contrato.

## Orçamento e governança

O orçamento é a referência central do planejamento físico-financeiro. O frontend deve ligar os itens a cronograma, contratos, medições, custos e BI.

Fluxo alvo:

```text
Rascunho → Em revisão → Aceito → Travado
                         ↑          │
                         └─ reabertura controlada
```

O frontend deve habilitar ou ocultar ações conforme papel e estado, mas a segurança e a trava real são responsabilidade do backend. Reabertura exige motivo; replanejamento deve preservar baseline, revisão, data, responsável e impacto.

Papéis de produto:

- `ADMIN`: pode exercer override administrativo, sempre auditado;
- `GERENTE`: edita e aceita dentro do escopo;
- `VISUALIZADOR`: somente leitura.

## BI e relatórios

O frontend exibe resultados calculados pelo backend, incluindo:

- PV, EV, AC, SPI/IDP, CPI/IDC e variações;
- saldo, completude de dados e auditoria de cálculo;
- Curva S e físico-financeiro;
- custos por etapa, fornecedor, grupo e categoria;
- comparativo de obras, rankings e alertas.

Próxima evolução, conforme [tasks backend/frontend](../docs/10-tasks-ajustes-backend-frontend.md):

- filtros por mês, organização, centro de custo, estado e obra;
- meta mensal, previsão do dia 15, previsão de fechamento, produzido, faturado, gastos e teto;
- margem, lucro, produzido não faturado, pendências e Pareto;
- estados explícitos para `null`, indisponível, erro de origem e dados incompletos;
- uma mesma fotografia canônica para dashboard, relatório e exportação.

## Importação, qualidade e relatórios

Importações devem oferecer preview, validação por linha/campo, erros por severidade, pendências de vínculo, rejeitados para download e resultado da versão criada.

O frontend não deve exibir `#DIV/0!`, `#N/A` ou converter indisponibilidade silenciosamente para zero. Deve apresentar a origem, período, unidade, data de corte e qualidade da métrica.

## Documentação relacionada

- [Documentação central do ObraControl](../docs/README.md);
- [Estrutura do frontend](../docs/05-estrutura-frontend.md);
- [Auditoria backend x frontend](../docs/09-auditoria-backend-x-front-end.md);
- [Tasks de ajustes](../docs/10-tasks-ajustes-backend-frontend.md);
- [Guia operacional de agentes](./AGENTS.md);
- [Registro documental](../docs/registro-documentos.md) (inclui a remoção do antigo `DESIGN.md`).

## Situação e dívidas conhecidas

A auditoria atual registra aproximadamente 259 arquivos TypeScript/TSX e sete arquivos de teste em `src`. O typecheck e o build já foram executados com sucesso na fotografia registrada; o check apontou problemas de imports/variáveis e formatação em rotas/dashboard. Ainda existem query keys literais, alguns GETs dentro de organisms e variações de loading/erro que devem ser tratadas pelas tasks FE-001 e FE-007.

## Repositório

Remote oficial: `git@github.com:EdGabrielOliveira/obracontrol-frontend.git`

O backend fica em `../obracontrol-backend` durante o desenvolvimento local.
