# ObraControl Backend

API oficial do ObraControl para autenticação, autorização, persistência, importação/exportação, cálculos de BI, obras, orçamento, cronograma, medições, contratos, pagamentos, custos, relatórios e API keys.

## Responsabilidades

O backend é a fonte oficial de:

- regras de domínio e validações;
- escopo organizacional e autorização;
- transações e persistência Prisma/SQLite;
- cálculos de orçamento, EVM, físico-financeiro e BI;
- importação/exportação de planilhas e relatórios;
- estados de governança, aceite, trava, reabertura e replanejamento;
- auditoria de alterações, importações e reprocessamentos.
- Teste

O frontend consome DTOs JSON-safe, apresenta os resultados e não reimplementa fórmulas de negócio.

## Stack e desenvolvimento local

- Bun + TypeScript;
- Elysia;
- Prisma 6 + SQLite;
- Zod;
- Better Auth;
- XLSX para importação/exportação;
- PDF-Lib para relatórios;
- Swagger, Sentry e rate limit em memória por processo.

Pré-requisitos: Bun e variáveis configuradas. O desenvolvimento local e a
produção (Dokploy) usam um arquivo SQLite; a produção persiste o banco e os
artefatos no volume `/data`.

```bash
bun install
bun prisma generate
bun run db:setup:local
bun run dev
```

A API inicia em `http://localhost:7001`.

Variáveis principais em `.env`:

```dotenv
NODE_ENV=development
PORT=7001
DATABASE_URL=file:./prisma/dev.db
BETTER_AUTH_SECRET=change-me-to-a-random-64-char-string
BETTER_AUTH_URL=http://localhost:7001
FRONTEND_ORIGIN=http://localhost:7000
SENTRY_DSN=
```

## Comandos

```bash
bun run dev          # servidor com watch
bun run start        # servidor sem watch
bun run typecheck    # TypeScript
bun run check        # Biome
bun run format       # formata arquivos
bun run test:unit        # testes unitários, de serviço, repositório, schema e rota
bun run test:integration # jornadas HTTP compostas sem banco real
bun run test:unity       # executa unit e integration
bun run test:e2e-db      # suítes sequenciais com SQLite descartável
bun run db:generate  # gera Prisma Client
bun run db:setup:local # sincroniza o SQLite usado pelo servidor Bun
bun run db:migrate:dev
bun run db:push
bun run db:studio
bun run db:seed        # seed destrutivo de demonstracao (trunca o banco)
bun run db:seed:smoke  # valida o seed: BI LIVE, baseline de versoes e cronograma
```

Health check: `GET /health`.

`bun run dev` e `bun run start` executam `db:setup:local` antes de iniciar o
servidor. Esse comando sincroniza `DATABASE_URL` (por padrão,
`prisma/dev.db`) com o schema Prisma sem aplicar seed. `db:migrate:dev` e
`db:push` são aliases dessa sincronização; `db:studio` abre o Prisma Studio no
SQLite alvo.

## Seed de demonstracao

`bun run db:seed` trunca o banco alvo e cria um portfolio completo para desenvolvimento e demonstracao no frontend:

- 4 usuarios de demonstracao com papéis `ADMIN`, `GERENTE`, `SUPERVISOR` e
  `GESTOR`. O email e a senha são definidos pelo seed; a senha pode ser
  sobrescrita por `SEED_DEMO_PASSWORD` e não deve ser reutilizada fora do
  ambiente local.
- 3 organizacoes, 6 centros de custo, 36 obras com orçamento, cronograma, medicoes e custos realistas.
- 7 fornecedores cadastrados, vinculados a todas as obras; contratos e custos com `supplierId`.
- Versoes baseline de orcamento (`BudgetVersion` VIGENTE + identidades + itens) e de cronograma (`ScheduleVersion` baseline) para todas as obras.
- Medicoes fisicas canonicas (`WorkMeasurement`), medições de import, alocacoes de custo, contratos com serviços/medicoes/pagamentos/pastas, API keys e auditoria.
- Valide com `bun run db:seed:smoke` (BI em modo LIVE, baseline de versoes e cronograma).

O seed e destrutivo por design (truncate de todas as tabelas publicas). O fixture de fornecedores vive em `prisma/fixtures/suppliers.ts`; os demais fixtures permanecem em `prisma/fixtures/`.

## Arquitetura

```text
route/controller
  → schema/DTO
  → service de domínio
  → repository com escopo
  → Prisma/SQLite
```

Calculadoras e adapters puros não acessam banco. Projections e builders podem agrupar ou formatar, mas não devem recalcular regras já definidas no núcleo de métricas.

Bootstrap em `src/index.ts` configura CORS, Swagger, Sentry, rate limit, headers de segurança, autenticação, health check e registro de módulos.

## Estrutura de diretórios

```text
src/
├── index.ts
├── lib/                         # auth, autorização, erros, paginação, Prisma
├── modules/
│   ├── organizations/           # organizações e centros de custo
│   ├── users/                   # usuários, papéis e memberships
│   ├── audit/                   # auditoria
│   ├── api-keys/                # API keys
│   └── construction-planning/   # núcleo de obras e BI
│       ├── routes/              # contratos HTTP Elysia
│       ├── schemas/             # entrada e filtros
│       ├── bi/                  # métricas, fatos mensais e projections
│       ├── calculators/         # cálculos de orçamento/medição/contrato
│       ├── imports/             # parser, normalização e validação
│       ├── schedule/            # cronograma e revisões
│       ├── dto/                 # respostas financeiras JSON-safe
│       ├── pdf/                 # relatórios PDF
│       └── *.service/repository # regras e persistência de domínio
└── ...
```

## Domínio e fonte de verdade

```text
Organização → Centro de Custo → Obra → Orçamento
                                      ├── Cronograma/baseline
                                      ├── Medições
                                      ├── Contratos/serviços
                                      ├── Custos/pagamentos
                                      └── BI/relatórios
```

O item de orçamento é a referência para planejamento físico-financeiro, cronograma, medições, contratos, custos e indicadores. Fornecedor é uma dimensão transversal ligada a contratos, custos, pagamentos e relatórios.

O schema Prisma contém modelos de autenticação, organizações, memberships, obras, itens de orçamento, baseline e revisões, medições, custos e alocações, contratos, serviços, pagamentos, pastas/arquivos, imports, auditoria e API keys. Valores monetários core usam `Decimal` e devem sair da API em formato JSON seguro.

## Prefixos e módulos da API

- `/health`;
- `/api/auth/*`;
- `/construction/*` para obras, orçamento, cronograma, medições, contratos, custos, BI, imports, exports, templates e relatórios;
- `/organizations/*` para organizações, centros de custo e relatórios de escopo;
- `/api-keys/*`;
- `/admin/*` para operações administrativas.

O Swagger é a referência de descoberta da API. Toda rota protegida deve declarar schema de entrada, tags, autenticação, papel mínimo e comportamento de erro.

## BI, métricas e fatos mensais

O backend já possui um núcleo de métricas que calcula e projeta:

- PV, EV, AC, SPI/IDP, CPI/IDC, variações e saldo;
- percentual planejado e medido;
- Curva S e físico-financeiro;
- custos por etapa, fornecedor, grupo e categoria;
- custos não apropriados, completude de dados e auditoria de cálculo;
- comparativo de obras, rankings e riscos.

O fato mensal gerencial já possui estrutura, service e endpoints versionados (`ConstructionMonthlyFact`, `monthly-fact.service.ts`, `POST/GET /construction/works/:workId/bi/monthly-facts`), cobrindo competência, origem, valores, fingerprint, status, reason e createdBy. A UI de fato mensal permanece bloqueada pelas decisões macro de métricas (`DEC-MET`), conforme o [registro de decisões macro](../Planejamentos/00-governanca/REGISTRO_DECISOES.md) e o [contrato histórico de métricas](../Documentos%20antigos/docs/12-contrato-canonico-de-metricas.md).

Campos previstos da fotografia mensal da planilha de referência:

- `Mes`/`Mes_Ref`, organização, centro de custo, obra/projeto e `Chave_TOTVS`;
- `Meta_Mensal`, previsão do dia 15, previsão de fechamento;
- produzido, previsão de faturamento, faturado, gastos, gasto de produção e teto;
- resultado, produzido não faturado, margem, lucro, atingimento, status e Pareto;
- responsável, pendência, ação, data prevista de resolução e qualidade da origem.

Essas métricas devem ser calculadas uma vez no núcleo canônico e reutilizadas
por dashboard, gestão, relatório e exportação. Existe estrutura interna de
projeção/snapshot, mas não há atualmente uma API pública para
`/construction/works/:workId/bi/snapshots`; não documente esse caminho como
contrato disponível ao frontend.

Regras de cálculo:

- backend é a fonte oficial;
- cada indicador informa fórmula, fonte, unidade, data de corte e completude;
- `0`, `null` e `UNAVAILABLE` são estados distintos;
- denominador zero não vira zero silenciosamente;
- `#DIV/0!` e `#N/A` da planilha são tratados como qualidade de dados, não como valores de negócio;
- a convenção de sinal de `Gastos` deve ser aprovada antes da implementação de `Resultado_Calculado`.

## Importação e exportação

Importações devem seguir o fluxo:

```text
upload → preview → validação → normalização → vínculo de escopo
       → transação → versão → auditoria → relatório de erros
```

O backend deve registrar origem, arquivo/importação, versão, linha/campo, erro, severidade, ação sugerida e responsável. Não aceitar vínculo silencioso por nome aproximado e não aprovar lote incoerente.

Relatórios e exportações devem derivar do snapshot canônico. A produção não deve depender de células de Excel, pivots ou `GETPIVOTDATA`.

## Governança, autorização e auditoria

Fluxo mínimo:

```text
Rascunho → Em revisão → Aceito → Travado
                         ↑          │
                         └─ reabertura com motivo
```

Papéis:

- `ADMIN`: administração e override administrativo auditado;
- `GERENTE`: edição e aceite operacional dentro do escopo;
- `VISUALIZADOR`: somente leitura.

Toda mutation deve validar:

1. sessão e papel;
2. organização, centro de custo e obra;
3. estado governado do recurso;
4. limites de saldo e consistência físico-financeira;
5. transação e registro de auditoria.

Replanejamento preserva baseline original, revisão, motivo, data, responsável e impacto nos indicadores.

## Contratos HTTP e erros

- entradas usam schemas Zod/Elysia;
- filtros são sanitizados e paginação mantém campos consistentes;
- respostas devem ser DTOs JSON-safe, sem `Decimal` cru;
- enums de status e tipos devem ser fechados e compartilhados com o frontend;
- nullable/optional deve refletir o comportamento real do banco e do serviço;
- erros devem retornar `message` e, quando aplicável, `errors[]` com `field`, `code` e `message`;
- não esconder falha de domínio com resposta 200 ou valor padrão não auditado.

## Testes e validação

Antes de finalizar uma alteração relevante:

```bash
bun run typecheck
bun run check
bun run test:unity
```

Priorizar testes de schema/rota, autorização e escopo, transação, orçamento, medições, contratos, pagamentos, imports, cálculos, paridade de snapshot e relatórios. Os testes E2E usam um arquivo SQLite descartável.

A organização completa das suítes e dos runners está em
[`tests/README.md`](./tests/README.md).

Validação transversal, comparação de rotas e divergências conhecidas ficam em
[contratos backend x frontend e validação](../docs/architecture/07-backend-frontend-contracts-and-validation.md).

## Documentação relacionada

- [Documentação estrutural do ObraControl](../docs/architecture/README.md);
- [Arquitetura e módulos do backend](../docs/architecture/04-backend-api-and-modules.md);
- [Modelo de dados e schemas](../docs/architecture/03-data-model-and-schemas.md);
- [Contratos backend x frontend e validação](../docs/architecture/07-backend-frontend-contracts-and-validation.md);
- [Fluxo de desenvolvimento](../docs/architecture/06-development-workflow.md);
- [Schema Prisma](./prisma/schema.prisma);
- [Guia operacional de agentes](./AGENTS.md).

## Situação e riscos conhecidos

Fotografia 2026-08-12: `bun run typecheck`, `bun run check` e `bun run test:unity` passam; a suíte backend validada teve 1.791 testes aprovados. `db:generate` pode falhar com `EPERM` enquanto dev servers (`bun run --watch src/index.ts`) estiverem segurando o Prisma Client; encerre-os antes de regenerar.

O E2E com banco real deve ser repetido em ambiente limpo quando exceder o
timeout. Os helpers de snapshot sem provedor foram removidos do frontend; o
backend continua expondo apenas os metadados de snapshot que fazem parte dos
DTOs de BI vigentes.

Existem migrations locais ainda não rastreadas (`20260805100000_supplier_approval_state`, `20260805110000_budget_version_approval_state`) e o `prisma/schema.prisma` local está à frente do `HEAD`; versionar e aplicar de forma controlada antes de qualquer deploy.

As próximas tasks prioritárias devem ser derivadas do estado validado em
[contratos backend x frontend e validação](../docs/architecture/07-backend-frontend-contracts-and-validation.md),
sem promover automaticamente documentos históricos a estado atual.

## Repositório

Remote oficial: `git@github.com:EdGabrielOliveira/obracontrol-backend.git`

O frontend fica em `../obracontrol-frontend` durante o desenvolvimento local.
