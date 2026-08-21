# Testes do backend

Todo código exclusivo de teste fica neste diretório:

- `unit/`: testes isolados, de serviço, repositório, schema e rota, espelhando
  a organização de `src/`;
- `integration/`: jornadas HTTP compostas que não usam o banco real;
- `e2e-db/`: cenários sequenciais contra um arquivo SQLite descartável;
- `support/`: helpers compartilhados exclusivamente pelos testes;
- `scripts/`: preparação do banco, runners sequenciais e smoke tests.

Comandos principais:

```powershell
bun run test:unit
bun run test:integration
bun run test:unity
bun run test:e2e-db
```

`test:e2e-db` exige `TEST_DATABASE_URL` apontando para um banco descartável e
executa os arquivos sequencialmente, pois cada suíte limpa e recria o mesmo
banco.
