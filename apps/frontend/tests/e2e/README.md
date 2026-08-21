# Frontend E2E

Os testes de navegador ficam organizados por jornada:

- `auth/`: login, redirecionamento e isolamento de escopo;
- `critical-flows/`: jornadas visuais e operacionais prioritárias;
- `support/`: helpers compartilhados, como autenticação.

O `playwright.config.ts` usa `tests/e2e` como `testDir`. Os testes continuam
sequenciais (`workers: 1`) porque compartilham o banco E2E preparado pelo
backend.

```powershell
bun run e2e
bun run e2e:ui
```

Para portas isoladas:

```powershell
$env:E2E_FRONTEND_PORT="7011"
$env:E2E_BACKEND_PORT="7012"
bun run e2e
```
