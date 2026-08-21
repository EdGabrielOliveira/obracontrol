-- ============================================================================
-- ObraControl — Script de Detecção de Dados Órfãos
-- Executar ANTES de qualquer migration que adicione FK constraints.
-- Este script é SOMENTE LEITURA — não modifica nenhum dado.
-- ============================================================================

-- 1. ConstructionMonthlyFact.workId → ConstructionWork (FK ausente)
SELECT 'ConstructionMonthlyFact' AS tabela,
       COUNT(*) AS orfaos,
       'workId aponta para ConstructionWork inexistente' AS descricao
FROM "ConstructionMonthlyFact" mf
WHERE NOT EXISTS (
  SELECT 1 FROM "ConstructionWork" w WHERE w.id = mf."workId"
);

-- 2. ConstructionBudgetReconciliation.workId → ConstructionWork (FK ausente)
SELECT 'ConstructionBudgetReconciliation (workId)' AS tabela,
       COUNT(*) AS orfaos,
       'workId aponta para ConstructionWork inexistente' AS descricao
FROM "ConstructionBudgetReconciliation" br
WHERE NOT EXISTS (
  SELECT 1 FROM "ConstructionWork" w WHERE w.id = br."workId"
);

-- 3. ConstructionBudgetReconciliation.budgetItemId → ConstructionBudgetItem (FK ausente)
SELECT 'ConstructionBudgetReconciliation (budgetItemId)' AS tabela,
       COUNT(*) AS orfaos,
       'budgetItemId aponta para ConstructionBudgetItem inexistente' AS descricao
FROM "ConstructionBudgetReconciliation" br
WHERE br."budgetItemId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ConstructionBudgetItem" bi WHERE bi.id = br."budgetItemId"
  );

-- 4. CostMigrationLineage.budgetVersionItemId → BudgetVersionItem (FK ausente)
SELECT 'CostMigrationLineage' AS tabela,
       COUNT(*) AS orfaos,
       'budgetVersionItemId aponta para BudgetVersionItem inexistente' AS descricao
FROM "CostMigrationLineage" cml
WHERE NOT EXISTS (
  SELECT 1 FROM "BudgetVersionItem" bvi WHERE bvi.id = cml."budgetVersionItemId"
);

-- 5. ApprovalRequest.organizationId → Organization (FK ausente)
SELECT 'ApprovalRequest (organizationId)' AS tabela,
       COUNT(*) AS orfaos,
       'organizationId aponta para Organization inexistente' AS descricao
FROM "ApprovalRequest" ar
WHERE NOT EXISTS (
  SELECT 1 FROM "Organization" o WHERE o.id = ar."organizationId"
);

-- 6. ApprovalRequest.costCenterId → CostCenter (FK ausente)
SELECT 'ApprovalRequest (costCenterId)' AS tabela,
       COUNT(*) AS orfaos,
       'costCenterId aponta para CostCenter inexistente' AS descricao
FROM "ApprovalRequest" ar
WHERE ar."costCenterId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "CostCenter" cc WHERE cc.id = ar."costCenterId"
  );

-- 7. ContractRequest.confirmedBatchId → ImportBatch (FK ausente)
SELECT 'ContractRequest (confirmedBatchId)' AS tabela,
       COUNT(*) AS orfaos,
       'confirmedBatchId aponta para ImportBatch inexistente' AS descricao
FROM "ContractRequest" cr
WHERE cr."confirmedBatchId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ImportBatch" ib WHERE ib.id = cr."confirmedBatchId"
  );

-- 8. ContractRequest.acceptedProposalId → ContractRequestProposal (FK ausente)
SELECT 'ContractRequest (acceptedProposalId)' AS tabela,
       COUNT(*) AS orfaos,
       'acceptedProposalId aponta para ContractRequestProposal inexistente' AS descricao
FROM "ContractRequest" cr
WHERE cr."acceptedProposalId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ContractRequestProposal" crp WHERE crp.id = cr."acceptedProposalId"
  );

-- 9. approvalRequestId em ConstructionSupplier (FK ausente)
SELECT 'ConstructionSupplier (approvalRequestId)' AS tabela,
       COUNT(*) AS orfaos,
       'approvalRequestId aponta para ApprovalRequest inexistente' AS descricao
FROM "ConstructionSupplier" cs
WHERE cs."approvalRequestId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ApprovalRequest" ar WHERE ar.id = cs."approvalRequestId"
  );

-- 10. approvalRequestId em ConstructionWorkSupplier (FK ausente)
SELECT 'ConstructionWorkSupplier (approvalRequestId)' AS tabela,
       COUNT(*) AS orfaos,
       'approvalRequestId aponta para ApprovalRequest inexistente' AS descricao
FROM "ConstructionWorkSupplier" cws
WHERE cws."approvalRequestId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ApprovalRequest" ar WHERE ar.id = cws."approvalRequestId"
  );

-- 11. approvalRequestId em ConstructionBudgetImpact (FK ausente)
SELECT 'ConstructionBudgetImpact (approvalRequestId)' AS tabela,
       COUNT(*) AS orfaos,
       'approvalRequestId aponta para ApprovalRequest inexistente' AS descricao
FROM "ConstructionBudgetImpact" cbi
WHERE cbi."approvalRequestId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ApprovalRequest" ar WHERE ar.id = cbi."approvalRequestId"
  );

-- ============================================================================
-- DIAGNÓSTICO DE ownerId
-- Verifica consistência do ownerId entre recursos e suas cadeias hierárquicas
-- ============================================================================

-- 12. Works com ownerId diferente da Organization pai
SELECT 'ConstructionWork (ownerId drift)' AS tabela,
       COUNT(*) AS divergencias,
       'ownerId do work difere do ownerId da organization pai' AS descricao
FROM "ConstructionWork" w
JOIN "CostCenter" cc ON cc.id = w."costCenterId"
JOIN "Organization" o ON o.id = cc."organizationId"
WHERE w."ownerId" <> o."ownerId";

-- 13. CostCenters com ownerId diferente da Organization pai
SELECT 'CostCenter (ownerId drift)' AS tabela,
       COUNT(*) AS divergencias,
       'ownerId do cost center difere do ownerId da organization pai' AS descricao
FROM "CostCenter" cc
JOIN "Organization" o ON o.id = cc."organizationId"
WHERE cc."ownerId" <> o."ownerId";

-- 14. Contracts com ownerId diferente da Organization raiz
SELECT 'Contract (ownerId drift)' AS tabela,
       COUNT(*) AS divergencias,
       'ownerId do contract difere do ownerId da organization raiz' AS descricao
FROM "Contract" c
JOIN "ConstructionWork" w ON w.id = c."workId"
JOIN "CostCenter" cc ON cc.id = w."costCenterId"
JOIN "Organization" o ON o.id = cc."organizationId"
WHERE c."ownerId" <> o."ownerId";

-- 15. ConstructionBudgetItem com ownerId diferente da Organization raiz
SELECT 'ConstructionBudgetItem (ownerId drift)' AS tabela,
       COUNT(*) AS divergencias,
       'ownerId do budget item difere do ownerId da organization raiz' AS descricao
FROM "ConstructionBudgetItem" bi
JOIN "ConstructionWork" w ON w.id = bi."workId"
JOIN "CostCenter" cc ON cc.id = w."costCenterId"
JOIN "Organization" o ON o.id = cc."organizationId"
WHERE bi."ownerId" <> o."ownerId";

-- 16. ownerId que não correspondem a nenhum User existente
SELECT 'Todas as tabelas (ownerId sem User)' AS tabela,
       COUNT(DISTINCT sub."ownerId") AS orfaos,
       'ownerIds que não correspondem a nenhum User.id existente' AS descricao
FROM (
  SELECT DISTINCT "ownerId" FROM "Organization"
  UNION SELECT DISTINCT "ownerId" FROM "CostCenter"
  UNION SELECT DISTINCT "ownerId" FROM "ConstructionWork"
  UNION SELECT DISTINCT "ownerId" FROM "Contract"
  UNION SELECT DISTINCT "ownerId" FROM "ConstructionBudgetItem"
  UNION SELECT DISTINCT "ownerId" FROM "ConstructionSupplier"
  UNION SELECT DISTINCT "ownerId" FROM "Company"
) sub
WHERE NOT EXISTS (
  SELECT 1 FROM "User" u WHERE u.id = sub."ownerId"
);

-- 17. Contagem de ownerIds distintos por tabela (diagnóstico multi-tenant)
SELECT 'Distribuição de ownerIds' AS tabela,
       'Organization' AS modelo,
       COUNT(DISTINCT "ownerId") AS ownerIds_distintos,
       COUNT(*) AS total_registros
FROM "Organization"
UNION ALL
SELECT 'Distribuição de ownerIds', 'Company',
       COUNT(DISTINCT "ownerId"), COUNT(*) FROM "Company"
UNION ALL
SELECT 'Distribuição de ownerIds', 'CostCenter',
       COUNT(DISTINCT "ownerId"), COUNT(*) FROM "CostCenter"
UNION ALL
SELECT 'Distribuição de ownerIds', 'ConstructionWork',
       COUNT(DISTINCT "ownerId"), COUNT(*) FROM "ConstructionWork"
UNION ALL
SELECT 'Distribuição de ownerIds', 'Contract',
       COUNT(DISTINCT "ownerId"), COUNT(*) FROM "Contract"
UNION ALL
SELECT 'Distribuição de ownerIds', 'ConstructionBudgetItem',
       COUNT(DISTINCT "ownerId"), COUNT(*) FROM "ConstructionBudgetItem";
