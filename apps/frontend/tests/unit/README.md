# Testes unitarios

Estruture os testes pela camada que esta sendo validada:

- `api/`: serializacao e contratos do cliente HTTP;
- `components/`: componentes e calculadoras visuais isoladas;
- `hooks/`: hooks sem dependencia de navegador real;
- `lib/`: autorizacao, formatacao e regras reutilizaveis;
- `routes/`: helpers de rota e normalizacao de search params;
- `schemas/`: validacao e transformacao Zod;
- `utils/`: funcoes puras pequenas;
- `fixtures/`: dados compartilhados apenas por testes.

Testes existentes que ainda nao se encaixam em uma dessas fronteiras podem
permanecer no diretorio legado ate uma migracao individual segura.
