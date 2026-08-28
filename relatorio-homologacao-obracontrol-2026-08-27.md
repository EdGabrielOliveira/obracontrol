# Relatório de homologação — ObraControl

**Execução:** 27–28/08/2026  
**Ambiente:** `http://localhost:7000/app`  
**Navegador:** Codex In-app Browser (Chromium)  
**Escopo:** plano de testes fornecido em `C:\Users\\Gabriel\\Downloads\\plano-testes-obracontrol (1).md`

## Status executivo

**❌ Não homologado para release.**

O sistema permitiu executar a maior parte da cadeia funcional com dados
sintéticos, mas foram confirmados bloqueios em autorização por perfil,
vinculação de fornecedores/contratos, medição financeira e consistência de
dados. Também há problemas relevantes no pipeline automatizado.

O backend respondeu com banco conectado em `http://localhost:7001/health`:
`{"status":"ok","database":"connected"}`. Não foram observados erros 5xx
ou erros de console durante os fluxos manuais registrados.

## Dados de homologação utilizados

Foram criados dados locais sintéticos, sem dados reais:

- conta ADMIN, SUPERVISOR, GESTOR e GERENTE;
- empresa, duas organizações e dois centros de custo (incluindo registros
  sintéticos de validação de espaços em branco);
- quatro fornecedores;
- uma obra (`OBRA-E8F7836C`), com orçamento ativo de R$ 318.950,00;
- três contratos;
- duas medições de obra;
- uma obra adicional sintética criada com intervalo de datas inválido para
  validar a regra de período;
- sete custos (incluindo dois registros sintéticos para aprovação/recusa);
- pagamentos pendente e pago;
- uma chave de API temporária, com expiração em 29/08/2026.

Registros sintéticos adicionais preservados para a etapa de exclusão autorizada:
organização sem nome `cmtcvtaam005p01p6kntqz08h`, centro sem nome
`cmtcvqki3005m01p6aw8e5p8d` e obra com datas invertidas
`7b0c9362-8be9-44e4-b7ae-e9d57af1330a`.

A chave de API foi criada e validada quanto à exibição única: após recarregar a
tela, somente o prefixo foi exibido. O valor completo não é reproduzido neste
documento.

## Cobertura executada

| Área | Resultado |
|---|---|
| Login, cadastro e validações públicas | Executado; validações básicas funcionam |
| Proteção de rotas anônimas | Executado; redireciona para login |
| Empresa com upload DOCX | Aprovado |
| Organização e centro de custo | Aprovado |
| Fornecedores, busca, detalhe e persistência | Executado; inconsistências encontradas |
| Usuários e perfis | Executado; vínculos de escopo inconsistentes |
| Obras, endereço e geocodificação | Aprovado |
| Importação de orçamento e aditivo XLSX | Executado; aditivo ativado com sucesso |
| Validação de extensão de arquivo | Aprovado; DOCX rejeitado no fluxo XLSX |
| Contratos e serviços | Executado; vínculo formal de fornecedor bloqueado |
| Pagamentos de contrato | Aprovado; registros pendente e pago criados |
| Medições de contrato | Executado; quantidade não refletida na listagem |
| Medições de obra e transições de status | Executado; aceite bloqueado por saldo incorreto |
| Custos e totais financeiros | Executado; dados criados, apresentação inadequada |
| Aprovações, notificações, auditoria e histórico | Executado; erros e escopo incompleto |
| Permissões por perfil | Executado; URLs diretas expõem telas indevidas |
| Responsividade | Aprovada em 1920×1080, 1366×768, 768×1024 e 390×844 |
| Navegação, documentação e rota inexistente | Aprovado |

## Erros funcionais encontrados

### BUG-001 — Toast de credenciais inválidas sem acentuação

- **Severidade:** baixa / P3
- **Módulo:** login
- **Evidência:** exibido `Credenciais invalidas`.
- **Esperado:** `Credenciais inválidas`.
- **Status:** aberto.

### BUG-011 — Validação de extensão XLSX sem acentuação

- **Severidade:** baixa / P3
- **Módulo:** importação de orçamento e cronograma
- **Evidência:** ao enviar DOCX no importador de cronograma, o sistema exibiu
  `Apenas arquivos .xlsx sao aceitos`.
- **Esperado:** `Apenas arquivos .xlsx são aceitos`.
- **Status:** aberto.

### BUG-002 — Vínculos de escopo de usuários não aparecem de forma consistente

- **Severidade:** alta / P1
- **Módulo:** usuários, organizações e centros de custo
- **Evidência:** após criar usuários com empresa, organização e/ou centro
  selecionados, a listagem exibiu `Sem vínculo` para o Supervisor e o Gerente;
  para o Gestor, exibiu apenas a organização, sem o centro de custo.
- **Impacto:** pode impedir o acesso correto às obras e distorcer a validação
  de permissões por escopo.
- **Status:** aberto.

### BUG-003 — Fornecedores cadastrados não ficam disponíveis no contrato

- **Severidade:** alta / P1
- **Módulo:** contratos e fornecedores
- **Evidência:** o combobox de fornecedor retornou `Nenhum fornecedor
  encontrado` para os quatro fornecedores aprovados. O formulário permitiu
  digitar texto livre e criou contrato sem `supplierId` formal.
- **Impacto:** o contrato não pode gerar instrumento; ficaram ausentes razão
  social, CNPJ, representante legal, CPF e endereço.
- **Status:** aberto; bloqueia o fluxo contratual completo.

### BUG-004 — Dados do fornecedor divergem entre detalhe e edição

- **Severidade:** alta / P1
- **Módulo:** fornecedores
 - **Evidência:** o detalhe do Fornecedor A mostrou contato, endereço e
   responsável; a tela de edição apresentou contato e número vazios, além de CPF
   do responsável desabilitado/vazio.
- **Reteste:** após salvar um novo contato, o detalhe mostrou o valor, mas a
  tela de edição voltou a exibir o contato vazio após recarregar; o número
  informado permaneceu salvo.
 - **Impacto:** risco de perda ou não persistência de dados necessários ao
   contrato.
 - **Status:** aberto.

### BUG-005 — Dashboard exibe enums internos e mensagens sem acentuação

- **Severidade:** média / P2
- **Módulo:** custos e dashboard da obra
- **Evidência:** a tabela mostrou `Custo nao apropriado (MATERIAL)`,
  `MAO_DE_OBRA`, `EQUIPAMENTO`, `OUTROS`, e status `PAID`/`OPEN`,
  enquanto os totais usaram rótulos parcialmente traduzidos.
- **Esperado:** rótulos de negócio em português, com acentuação e estado de
  apropriação coerente.
- **Status:** aberto.

### BUG-006 — Aceite da medição é bloqueado por saldo orçamentário incorreto

- **Severidade:** alta / P1
- **Módulo:** orçamento e medições
- **Evidência:** orçamento ativo de R$ 318.950,00; medição de R$ 60.000,00 para
  item orçado em R$ 60.000,00. Ao mudar de Rascunho para Aceito, o sistema
  retornou `Saldo orcamentario insuficiente` e manteve Rascunho.
- **Impacto:** impede o fluxo normal de aprovação/execução financeira.
- **Status:** aberto.

### BUG-007 — Quantidade da medição contratual não é refletida

- **Severidade:** média / P2
- **Módulo:** medições de contrato
- **Evidência:** foi informada quantidade `0,5` para o serviço; após salvar, a
  listagem exibiu `Qtd. medida -` e `% medido -`.
- **Status:** aberto.

### BUG-008 — Aditivo de contrato falha após seleção de medição válida

- **Severidade:** média / P2
- **Módulo:** aditivos de contrato
- **Evidência:** após criar a medição e selecioná-la no formulário de aditivo,
  salvar retornou `Todas as medições do aditivo devem pertencer ao contrato`.
- **Impacto:** impede validar o aditivo contratual mesmo com medição disponível.
- **Status:** aberto.

### BUG-009 — Autorização inadequada por acesso direto às URLs

- **Severidade:** crítica / P0
- **Módulo:** autorização e controle de acesso
- **Evidência:** o menu ocultou opções para perfis sem permissão, porém:
  - SUPERVISOR acessou `/app/auditoria`;
  - GESTOR acessou `/app/auditoria` e `/app/configuracoes`, incluindo API Keys;
  - GERENTE acessou `/app/usuarios`, com gerenciamento de usuários, e
    `/app/configuracoes`; a aba `API Keys` exibiu `Nova chave`, mesmo sem
    autorização administrativa aparente.
- **Esperado:** autorização server-side por recurso e ação, não apenas
  ocultação de menu.
- **Impacto:** exposição de dados administrativos e possibilidade de operações
  indevidas por URL direta.
- **Status:** aberto; corrigir antes de release.

### BUG-010 — Rota de aprovações da obra falha para Supervisor

- **Severidade:** média / P2
- **Módulo:** aprovações
- **Evidência:** SUPERVISOR acessou a aprovação da obra e recebeu `Erro ao
  carregar aprovações`, com botão `Tentar novamente`; em outras sessões a mesma
  rota exibiu estado vazio.
- **Status:** aberto.

## Achados adicionais da segunda rodada

### BUG-012 — CNPJ inválido e CNPJ duplicado são aceitos no cadastro de empresa

- **Severidade:** alta / P1
- **Módulo:** empresas
- **Evidência:** o cadastro aceitou `11.111.111/1111-11` e também permitiu cadastrar uma segunda empresa com o CNPJ já existente `04.252.011/0001-10`.
- **Impacto:** permite dados cadastrais inválidos e duplicidade de empresa.
- **Status:** aberto; os registros sintéticos foram preservados para o teste de exclusão.

### BUG-013 — Telefone informado na edição da empresa não é exibido após salvar

- **Severidade:** média / P2
- **Módulo:** empresas
- **Evidência:** o e-mail editado apareceu no detalhe, mas o telefone informado (`(11) 98888-1111`) continuou como `Não informado` após o salvamento.
- **Status:** aberto.

### BUG-014 — Edição de organização, centro de custo e obra não conclui nem persiste

- **Severidade:** alta / P1
- **Módulo:** organização, centro de custo e obra
- **Evidência:** alterações de nome, responsável/status e dados da obra permaneceram na tela de edição, sem toast ou navegação; após recarregar, os valores não estavam persistidos.
- **Impacto:** impede a manutenção confiável dos cadastros.
- **Status:** aberto.

### BUG-015 — Valor negativo de custo é transformado e aceito como R$ 0,10

- **Severidade:** alta / P1
- **Módulo:** custos
- **Evidência:** ao informar `-10`, a listagem criou `Custo negativo de teste` com valor `R$ 0,10`.
- **Impacto:** risco direto de distorção financeira.
- **Status:** aberto; registro sintético preservado para exclusão.

### BUG-016 — Mensagens de validação técnicas ou sem acentuação

- **Severidade:** baixa / P3
- **Módulo:** formulários
- **Evidência:** foram exibidos `Invalid input`, `CPF ou CNPJ deve conter 11 ou 14 digitos`, `Too small: expected number to be >0` e mensagens sem acento.
- **Esperado:** mensagens em PT-BR, compreensíveis e orientadas ao usuário.
- **Status:** aberto.

### BUG-017 — Importação de custos fica indefinidamente em “analisando a planilha”

- **Severidade:** média / P2
- **Módulo:** importação de custos
- **Evidência:** o upload de um DOCX no importador de custos permaneceu em `analisando a planilha...` mesmo após vários segundos, sem concluir ou apresentar erro final.
- **Status:** aberto.

### BUG-018 — Relatórios PDF de organização e centro de custo falham

- **Severidade:** alta / P1
- **Módulo:** relatórios
- **Evidência:** `Baixar PDF` nas telas de organização e centro de custo retornou `Erro ao gerar PDF`; nenhum arquivo foi disponibilizado.
- **Status:** aberto.

### BUG-019 — Busca de contratos não encontra pelo código

- **Severidade:** média / P2
- **Módulo:** contratos
- **Evidência:** buscar `CTR-TEST-002` retornou `0 registro(s)`, enquanto buscar `Contrato B` retornou o contrato corretamente.
- **Status:** aberto.

### BUG-020 — Análise multi-centros/multi-obras exibe o literal `null`

- **Severidade:** média / P2
- **Módulo:** estatísticas
- **Evidência:** as telas de análise exibiram `null acima do orçado`.
- **Esperado:** valor válido ou estado vazio traduzido, nunca o literal `null`.
- **Status:** aberto.

### BUG-021 — Reenvio de solicitação recusada falha com duplicidade genérica

- **Severidade:** alta / P1
- **Módulo:** aprovações e custos
- **Evidência:** uma solicitação criada pelo Supervisor foi recusada pelo
  Gestor com justificativa. O Supervisor recebeu a notificação, mas ao editar
  o custo recusado, corrigir a descrição, restabelecer o vínculo orçamentário
  e salvar para reenviar, o sistema permaneceu na tela e exibiu
  `Ja existe um registro com este .`.
- **Impacto:** impede o ciclo previsto de corrigir e reenviar uma solicitação
  recusada.
- **Status:** aberto.

### BUG-022 — Campo obrigatório aceita somente espaços no centro de custo

- **Severidade:** alta / P1
- **Módulo:** centros de custo
- **Evidência:** no cadastro de centro, após selecionar a organização, o campo
  `Nome do centro` foi preenchido somente com espaços. O sistema criou o
  registro e redirecionou para o detalhe, exibindo o nome vazio como `Obras`,
  sem mensagem de validação.
- **Impacto:** permite cadastros sem identificação e pode comprometer buscas,
  relacionamentos e relatórios.
- **Status:** aberto; registro sintético preservado para exclusão.

### BUG-023 — Obra pode ser criada com data final anterior à inicial

- **Severidade:** alta / P1
- **Módulo:** obras e validação de datas
- **Evidência:** foi criada a obra sintética `Obra data inválida teste` com
  início em `28/08/2026` e fim em `27/08/2026`. O sistema confirmou a criação e
  exibiu o intervalo invertido no resumo, sem validação ou bloqueio.
- **Impacto:** compromete cronogramas, indicadores de prazo e relatórios.
- **Status:** aberto; registro sintético preservado para exclusão.

### BUG-024 — Campo obrigatório aceita somente espaços na organização

- **Severidade:** alta / P1
- **Módulo:** organizações
- **Evidência:** após selecionar a empresa, o campo `Nome` foi preenchido
  somente com espaços. O sistema confirmou `Órgão criado com sucesso!` e a
  listagem passou a exibir uma organização sem nome.
- **Impacto:** permite cadastro sem identificação e prejudica relacionamentos,
  seleção, busca e relatórios.
- **Status:** aberto; registro sintético preservado para exclusão.

## Bloqueios de automação e reteste

### BLOQ-001 — E2E de backend não possui seed/ambiente reproduzível

`bun run test:e2e-db` falhou inicialmente por ausência de
`BETTER_AUTH_SECRET`/`ADMIN_REGISTRATION_KEY`. Com valores efêmeros, o seed
falhou em `User not found` para `owner-a@e2e.obra.bi`, antes das assertions.

### BLOQ-002 — E2E frontend não lista testes com o runner atual

`bun run e2e -- --list` falhou ao carregar imports `bun:` e terminou com
`Total: 0 tests in 0 files`.

### BLOQ-003 — Baseline unitário/integrado não está verde

Com configuração efêmera, a suíte unitária terminou em `1557 pass / 178 fail`
de 1735 testes; a integração em `29 pass / 143 fail` de 172. Foram observados,
entre outros, mocks/configuração ausentes como
`prisma.companyMembership.findMany` indefinido.

### BLOQ-004 — Exportações não produziram evento de download observável

Os botões de exportação de orçamento, custos e medições foram acionados, mas o
navegador não observou o evento de download dentro da janela de espera. A
verificação posterior no diretório de Downloads encontrou os três XLSX
correspondentes, todos abrindo como workbooks íntegros: orçamento com abas de
orçamento/cronogramas/versões, custos com a aba `Custos Realizados` e medições
com a aba `Medicoes Obra`. O arquivo de medições não contém linhas de dados,
coerente com a medição bloqueada antes do aceite. A integridade física dos
XLSX foi confirmada; permanecem sem confirmação equivalente os PDFs, boletim,
modelo de contrato e demais relatórios que não produziram arquivo observável.
Como conferência de conteúdo, a soma dos nove itens da aba de orçamento foi
R$ 318.950,00, igual ao orçamento ativo observado na aplicação; a soma dos
quatro custos exportados foi R$ 12.500,00, com dois registros `PAID` e dois
`OPEN`, correspondendo ao conjunto exportado nessa rodada.

## Fluxos deliberadamente preservados ou não concluídos

Não foram executadas exclusões/revogações definitivas para preservar o ambiente
de homologação; as confirmações destrutivas ainda são necessárias no momento
imediatamente anterior à execução. A chave de API sintética foi deixada com
expiração curta. Também ficaram pendentes: chamadas HTTP autenticadas usando a
chave, confirmação de arquivo exportado, teste de expiração real de sessão,
pagamento vinculado a medição, validação dos documentos que não geraram arquivo
e revalidação após correção dos bloqueios.

O fluxo de aprovação positivo foi concluído: Supervisor criou e enviou, Gestor
aprovou com comentário, o Supervisor recebeu a notificação e o Gerente
visualizou o evento no histórico. O fluxo de recusa também foi concluído até a
notificação e justificativa; o reenvio após correção ficou bloqueado pelo
BUG-021. A rota de aprovações da obra continua apresentando erro para o
Supervisor (BUG-010).

O caminho positivo de importação de cronograma foi exercitado com XLSX, mas o
sistema retornou a regra de negócio de que somente itens atrasados e não
concluídos podem ser replanejados; a obra sintética não possuía esses itens.

## Resumo

| Indicador | Resultado |
|---|---:|
| Domínios funcionais exercitados | 18 |
| Erros funcionais documentados | 24 |
| Bloqueios de automação/reteste | 4 |
| Findings críticos/P0 | 1 |
| Findings altos/P1 | 12 |
| Findings médios/P2 | 8 |
| Findings baixos/P3 | 3 |
| Erros de console observados nos fluxos finais | 0 |
| Erros 5xx confirmados durante a navegação | 0 |

## Prioridade recomendada

1. Corrigir autorização server-side (BUG-009).
2. Corrigir cadastro/consulta de fornecedores e vínculo formal em contratos
   (BUG-003 e BUG-004).
3. Corrigir cálculo/regra de saldo no aceite de medições (BUG-006).
4. Corrigir persistência de quantidade e validação de aditivos (BUG-007 e
   BUG-008).
5. Corrigir vínculos de escopo e repetir a matriz de perfis (BUG-002).
6. Reestabelecer seeds, mocks e runner das suítes automatizadas (BLOQ-001 a
   BLOQ-003), então retestar exportações (BLOQ-004).

**Conclusão:** o ambiente local está operacional para desenvolvimento e os
principais fluxos foram exercitados, mas o produto deve permanecer **não
homologado para release** até a correção dos achados P0/P1 e a execução
reprodutível das suítes automatizadas.

## Atualização pós-correção — 28/08/2026

Foi aplicada uma rodada de correções diretamente no código e os serviços foram
recompilados/reiniciados com `docker compose`. O backend e o frontend ficaram
saudáveis no ambiente local.

### Achados corrigidos

Todos os BUGs funcionais deste relatório receberam correção no código:

- BUG-001, BUG-011 e BUG-016: mensagens de login e validação em PT-BR, com
  acentuação e tradução de erros técnicos comuns.
- BUG-002: vínculos de organização, centro, obra e empresa passaram a ser
  resolvidos e exibidos por escopo efetivo.
- BUG-003 e BUG-004: fornecedor vinculado à obra passou a ser a fonte formal
  do contrato; o cadastro, detalhe e edição preservam os dados estruturados.
- BUG-005 e BUG-020: enums, estados financeiros, indicadores incompletos e
  valores ausentes passaram a usar rótulos de negócio ou `Sem informações`.
- BUG-006 e BUG-007: referências do orçamento ativo/versão vigente e campos
  de quantidade das medições foram alinhados ao cálculo financeiro.
- BUG-008: aditivos aceitam medições pertencentes ao contrato, sem exigir
  indevidamente que elas já estejam aceitas.
- BUG-009 e BUG-010: autorização passou a ser verificada no carregamento das
  rotas e nas consultas; perfis sem capacidade são redirecionados e não fazem
  chamadas administrativas indevidas.
- BUG-012 e BUG-013: CNPJ é validado por dígitos verificadores, duplicidade é
  bloqueada e telefone/endereço são normalizados e persistidos.
- BUG-014: edição de obra, organização e centro de custo usa escopo de
  workspace/owner correto, atualiza o registro e invalida os dados exibidos.
- BUG-015 e BUG-022 a BUG-024: valores financeiros positivos, nomes não vazios
  e intervalo de datas válido passaram a ser exigidos no frontend e backend.
- BUG-017: importações inválidas deixam de permanecer indefinidamente em
  análise e exibem erro orientado ao usuário.
- BUG-018: relatórios PDF de organização e centro de custo usam o escopo do
  recurso e geram o arquivo corretamente.
- BUG-019: busca de contratos considera código, fornecedor e título; a tabela
  não aplica uma segunda filtragem client-side que ocultava códigos.
- BUG-021: correção de custo recusado cria novo pedido de aprovação, com nova
  chave de idempotência e vínculo ao pedido anterior.

### Evidências do reteste

- `bun run typecheck`: aprovado para backend e frontend.
- Testes frontend: **96 aprovados, 0 falhas, 544 expectativas**.
- Testes direcionados de autorização, CNPJ e empresas: **60 aprovados, 0
  falhas**.
- Testes direcionados de medição de obra: **14 aprovados, 0 falhas**.
- Testes direcionados de governança/aprovação: **40 aprovados, 0 falhas**.
- Testes direcionados de schema de contrato: **8 aprovados, 0 falhas**.
- Testes de contrato deferido: **3 aprovados, 0 falhas**.
- Navegador: sessão SUPERVISOR não acessa auditoria, configurações, usuários
  ou aprovações; sessão ADMIN acessa auditoria; login inválido mostra
  `Credenciais inválidas`; PDFs de organização e centro de custo foram
  baixados; busca por `ENG-001-C-001` retornou o contrato correto; não houve
  erros de console no reteste final.

### Pendência de infraestrutura de testes

A suíte unitária completa ainda terminou com **1.555 aprovados e 180 falhas**.
As falhas remanescentes concentram-se em mocks/fixtures antigos e módulos que
esperam APIs de teste incompatíveis com a implementação atual, incluindo
`prisma.companyMembership.findMany` ausente em alguns cenários. Isso não foi
tratado como correção funcional do relatório, pois exige reestruturar a base de
testes. Os bloqueios E2E de seed/runner descritos em BLOQ-001 a BLOQ-003 também
continuam registrados; BLOQ-004 foi parcialmente revalidado com os PDFs e
XLSX baixados durante a rodada.

Com isso, os BUGs funcionais reportados foram corrigidos, mas a homologação de
release continua condicionada à regularização da suíte automatizada completa.
