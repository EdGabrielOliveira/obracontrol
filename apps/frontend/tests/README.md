# Testes do frontend

Esta pasta concentra toda a verificacao automatizada do frontend. Arquivos de
teste nao devem ser criados em `src/`.

## Camadas

- `unit/`: funcoes puras, schemas, hooks, componentes isolados e adaptadores de
  API sem servidor real.
- `e2e/`: jornadas completas no navegador, com frontend e backend executando.
- `fixtures/`: dados pequenos e estaveis reutilizados por testes unitarios.
- `mocks/`: doubles de transporte, sessao e estado remoto; nao substituem
  testes de contrato do backend.

## Convencoes

- Use `*.test.ts` para testes unitarios e `*.spec.ts` para Playwright.
- Organize os unitarios por fronteira: `api`, `components`, `hooks`, `lib`,
  `routes`, `schemas` e `utils`.
- Um teste deve validar comportamento observavel, nao detalhes internos de
  implementacao.
- Dados financeiros, estados e enums devem refletir o DTO real do backend.
- Jornadas E2E devem reutilizar helpers de `e2e/support` e permanecer
  sequenciais quando dependerem do banco compartilhado.

## Comandos

```powershell
bun run test
bun run test:watch
bun run test:coverage
bun run e2e
```
