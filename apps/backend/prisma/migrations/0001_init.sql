-- CreateTable
CREATE TABLE "ConstructionBudgetItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "identityId" TEXT,
    "parentId" TEXT,
    "index" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL,
    "laborUnitCost" DECIMAL,
    "materialUnitCost" DECIMAL,
    "equipmentUnitCost" DECIMAL,
    "otherUnitCost" DECIMAL,
    "unitCostTotal" DECIMAL,
    "totalBudget" DECIMAL,
    "unitCost" DECIMAL,
    "totalCost" DECIMAL NOT NULL,
    "plannedStart" DATETIME,
    "plannedEnd" DATETIME,
    "actualStart" DATETIME,
    "actualEnd" DATETIME,
    "completionPercentage" DECIMAL NOT NULL DEFAULT 0,
    "providedStatus" TEXT,
    "computedStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConstructionBudgetItem_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionBudgetItem_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ConstructionImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionBudgetItem_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "BudgetItemIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConstructionBudgetItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sourceVersionId" TEXT,
    "reason" TEXT,
    "submittedAt" DATETIME,
    "approvalRequestId" TEXT,
    "budgetImportId" TEXT,
    "kind" TEXT,
    "acrescimoBruto" DECIMAL,
    "supressao" DECIMAL,
    "impactoLiquido" DECIMAL,
    "percentualImpacto" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetVersion_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetItemIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "index" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetItemIdentity_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetVersionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "sourceVersionItemId" TEXT,
    "parentVersionId" TEXT,
    "index" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL,
    "unitCost" DECIMAL,
    "totalCost" DECIMAL NOT NULL,
    "plannedStart" DATETIME,
    "plannedEnd" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetVersionItem_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BudgetVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetVersionItem_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "BudgetItemIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetVersionItem_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "BudgetVersionItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetVersionItem_sourceVersionItemId_fkey" FOREIGN KEY ("sourceVersionItemId") REFERENCES "BudgetVersionItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionBudgetReconciliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "budgetItemId" TEXT,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BudgetProjectionState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "sourceVersionId" TEXT,
    "lastError" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetProjectionState_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetProjectionOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    "processedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetProjectionOutbox_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierId" TEXT,
    "serviceType" TEXT,
    "objectDescription" TEXT,
    "title" TEXT,
    "contractValue" DECIMAL NOT NULL,
    "penaltyPercent" DECIMAL NOT NULL DEFAULT 20,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "createdBy" TEXT,
    "notes" TEXT,
    "contractRequestId" TEXT,
    "instrumentGeneratedAt" DATETIME,
    "instrumentGeneratedBy" TEXT,
    "instrumentTemplateVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "ConstructionSupplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_contractRequestId_fkey" FOREIGN KEY ("contractRequestId") REFERENCES "ContractRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractInstrumentArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BLOB NOT NULL,
    "sha256" TEXT NOT NULL,
    "templateSha256" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractInstrumentArtifact_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'ITEM',
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL,
    "unitCost" DECIMAL,
    "totalCost" DECIMAL,
    "budgetItemId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractService_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractService_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContractService" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractService_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "title" TEXT,
    "discountValue" DECIMAL,
    "retentionValue" DECIMAL,
    "taxValue" DECIMAL,
    "balanceOverride" BOOLEAN NOT NULL DEFAULT false,
    "evidenceNote" TEXT,
    "createdBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractMeasurement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractMeasurementItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "measurementId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "measuredQuantity" DECIMAL,
    "measuredValue" DECIMAL,
    "measuredPercentage" DECIMAL,
    "accumulatedQuantity" DECIMAL,
    "accumulatedValue" DECIMAL,
    "accumulatedPercentage" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractMeasurementItem_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "ContractMeasurement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractMeasurementItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ContractService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "measurementId" TEXT,
    "date" DATETIME NOT NULL,
    "value" DECIMAL NOT NULL,
    "description" TEXT,
    "retentionValue" DECIMAL,
    "discountValue" DECIMAL,
    "paidValue" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EM_ABERTO',
    "balanceOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractPayment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractPayment_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "ContractMeasurement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractFolder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "mimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ContractFolder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionContractAmendment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ADITIVO',
    "value" DECIMAL NOT NULL,
    "reason" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING_GESTOR',
    "gestorReviewedBy" TEXT,
    "gestorReviewedAt" DATETIME,
    "gerenteReviewedBy" TEXT,
    "gerenteReviewedAt" DATETIME,
    "effectiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConstructionContractAmendment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractAmendmentMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "amendmentId" TEXT NOT NULL,
    "measurementId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractAmendmentMeasurement_amendmentId_fkey" FOREIGN KEY ("amendmentId") REFERENCES "ConstructionContractAmendment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractAmendmentMeasurement_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "ContractMeasurement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "importId" TEXT,
    "budgetItemId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "index" TEXT NOT NULL,
    "title" TEXT,
    "measurementDate" DATETIME,
    "measuredPercentageAccumulated" DECIMAL,
    "measuredQuantityAccumulated" DECIMAL,
    "measuredValue" DECIMAL,
    "status" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConstructionMeasurement_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionMeasurement_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ConstructionImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionMeasurement_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionActualCost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "importId" TEXT,
    "budgetItemId" TEXT,
    "budgetVersionItemId" TEXT,
    "rowNumber" INTEGER,
    "costDate" DATETIME,
    "budgetIndex" TEXT,
    "category" TEXT NOT NULL,
    "categoryDetail" TEXT,
    "description" TEXT,
    "amount" DECIMAL NOT NULL,
    "costType" TEXT NOT NULL,
    "sourceDocument" TEXT,
    "appropriationStatus" TEXT NOT NULL,
    "supplierName" TEXT,
    "supplierId" TEXT,
    "costGroup" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "competenceDate" DATETIME,
    "dueDate" DATETIME,
    "paymentDate" DATETIME,
    "documentNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConstructionActualCost_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionActualCost_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ConstructionImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionActualCost_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConstructionActualCost_budgetVersionItemId_fkey" FOREIGN KEY ("budgetVersionItemId") REFERENCES "BudgetVersionItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConstructionActualCost_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "ConstructionSupplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CostMigrationLineage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "sourceCostId" TEXT NOT NULL,
    "successorCostId" TEXT NOT NULL,
    "budgetVersionItemId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lineageKey" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostMigrationLineage_sourceCostId_fkey" FOREIGN KEY ("sourceCostId") REFERENCES "ConstructionActualCost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CostMigrationLineage_successorCostId_fkey" FOREIGN KEY ("successorCostId") REFERENCES "ConstructionActualCost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActualCostAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actualCostId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "basis" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "percentage" DECIMAL NOT NULL,
    "value" DECIMAL NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActualCostAllocation_actualCostId_fkey" FOREIGN KEY ("actualCostId") REFERENCES "ConstructionActualCost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActualCostAllocation_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "discountValue" DECIMAL,
    "retentionValue" DECIMAL,
    "balanceOverride" BOOLEAN NOT NULL DEFAULT false,
    "evidenceNote" TEXT,
    "createdBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkMeasurement_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkMeasurementItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "measurementId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "measuredQuantity" DECIMAL,
    "measuredValue" DECIMAL,
    "measuredPercentage" DECIMAL,
    "accumulatedQuantity" DECIMAL,
    "accumulatedValue" DECIMAL,
    "accumulatedPercentage" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkMeasurementItem_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "WorkMeasurement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkMeasurementItem_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionMeasurementCoverage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workMeasurementItemId" TEXT NOT NULL,
    "contractMeasurementItemId" TEXT NOT NULL,
    "quantity" DECIMAL,
    "amount" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConstructionMeasurementCoverage_workMeasurementItemId_fkey" FOREIGN KEY ("workMeasurementItemId") REFERENCES "WorkMeasurementItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionMeasurementCoverage_contractMeasurementItemId_fkey" FOREIGN KEY ("contractMeasurementItemId") REFERENCES "ContractMeasurementItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GovernanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "version" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "action" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "approverRole" TEXT,
    "valueLimit" DECIMAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "commandId" TEXT,
    "effectAction" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "expectedVersion" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "requiredApproverRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" DATETIME,
    "executedAt" DATETIME,
    "conflictReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApprovalRequest_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalReversalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expectedVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EXECUTED',
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalReversalRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT,
    "decisionMode" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalDecision_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    "dismissedAt" DATETIME,
    CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityDescription" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "auditLogId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditComment_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditComment_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SUPERVISOR',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpires" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserScopeGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "UserScopeGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "scopeJson" JSONB,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "acceptedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserInvitation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "organizationId" TEXT,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GERENTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CostCenterMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "costCenterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GERENTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "CostCenterMembership_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CostCenterMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GERENTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "WorkMembership_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT,
    "fileName" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "importedSections" JSONB NOT NULL DEFAULT [],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorSummary" JSONB,
    "reprocessOfId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConstructionImport_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT,
    "model" TEXT NOT NULL,
    "title" TEXT,
    "version" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PARSING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "batchVersion" INTEGER NOT NULL DEFAULT 1,
    "reprocessOfId" TEXT,
    "quotationId" TEXT,
    "contractRequestId" TEXT,
    "errorSummary" JSONB,
    "parsedWorkbook" JSONB,
    "preview" JSONB,
    "expiresAt" DATETIME NOT NULL,
    "confirmedAt" DATETIME,
    "confirmedImportId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportBatch_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportBatch_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportBatch_contractRequestId_fkey" FOREIGN KEY ("contractRequestId") REFERENCES "ContractRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "sheet" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "issues" JSONB,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionLedgerEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "budgetItemIdentityId" TEXT NOT NULL,
    "budgetVersionItemId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "competence" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "approvalDecisionId" TEXT,
    "budgetImpactId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConstructionLedgerEvent_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionLedgerEvent_budgetItemIdentityId_fkey" FOREIGN KEY ("budgetItemIdentityId") REFERENCES "BudgetItemIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionLedgerEvent_budgetVersionItemId_fkey" FOREIGN KEY ("budgetVersionItemId") REFERENCES "BudgetVersionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionLedgerEvent_approvalDecisionId_fkey" FOREIGN KEY ("approvalDecisionId") REFERENCES "ApprovalDecision" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConstructionLedgerEvent_budgetImpactId_fkey" FOREIGN KEY ("budgetImpactId") REFERENCES "ConstructionBudgetImpact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionBudgetImpact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "budgetItemIdentityId" TEXT NOT NULL,
    "budgetVersionItemId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "impactType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "quantity" DECIMAL,
    "budgetUnitCostSnapshot" DECIMAL,
    "operationUnitCost" DECIMAL,
    "amount" DECIMAL NOT NULL,
    "approvalRequestId" TEXT,
    "parentImpactId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" DATETIME,
    "reversedAt" DATETIME,
    CONSTRAINT "ConstructionBudgetImpact_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionBudgetImpact_budgetItemIdentityId_fkey" FOREIGN KEY ("budgetItemIdentityId") REFERENCES "BudgetItemIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionBudgetImpact_budgetVersionItemId_fkey" FOREIGN KEY ("budgetVersionItemId") REFERENCES "BudgetVersionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionBudgetImpact_parentImpactId_fkey" FOREIGN KEY ("parentImpactId") REFERENCES "ConstructionBudgetImpact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionMonthlyFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "valores" JSONB,
    "fingerprint" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "tradeName" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "structuredAddressId" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "managerName" TEXT,
    "contractTemplate" TEXT,
    "contractTemplateType" TEXT,
    "contractTemplateBlob" BLOB,
    "contractTemplateSha256" TEXT,
    "contractTemplateVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Company_structuredAddressId_fkey" FOREIGN KEY ("structuredAddressId") REFERENCES "Address" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zipCode" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "complement" TEXT,
    "latitude" DECIMAL,
    "longitude" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT,
    "managerName" TEXT,
    "address" TEXT,
    "structuredAddressId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Organization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Organization_structuredAddressId_fkey" FOREIGN KEY ("structuredAddressId") REFERENCES "Address" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "managerName" TEXT,
    "address" TEXT,
    "structuredAddressId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CostCenter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CostCenter_structuredAddressId_fkey" FOREIGN KEY ("structuredAddressId") REFERENCES "Address" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionSupplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "responsibleName" TEXT,
    "responsibleDocument" TEXT,
    "contact" TEXT,
    "pixKey" TEXT,
    "pixKeyType" TEXT,
    "bankCode" TEXT,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "bankAccount" TEXT,
    "bankAccountType" TEXT,
    "addressZipCode" TEXT,
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressComplement" TEXT,
    "addressDistrict" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "approvalRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConstructionWorkSupplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "approvalRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConstructionWorkSupplier_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionWorkSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "ConstructionSupplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "contractCode" TEXT,
    "serviceType" TEXT,
    "title" TEXT NOT NULL,
    "observation" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'EM_COTACAO',
    "maxSuppliers" INTEGER NOT NULL DEFAULT 3,
    "contractId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quotation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuotationBudgetItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuotationBudgetItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuotationBudgetItem_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuotationProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quotationId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierDocument" TEXT,
    "supplierName" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "supplierAddress" TEXT,
    "supplierPhone" TEXT,
    "supplierEmail" TEXT,
    "supplierResponsible" TEXT,
    "serviceDescription" TEXT,
    "serviceStartDate" DATETIME,
    "executionTermDays" INTEGER,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "justification" TEXT,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuotationProposal_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuotationRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quotationId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationRound_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProposalNegotiationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "previousValue" DECIMAL NOT NULL,
    "newValue" DECIMAL NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalNegotiationEvent_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "QuotationRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProposalNegotiationEvent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "QuotationProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'EM_ESPERA',
    "confirmedBatchId" TEXT,
    "acceptedProposalId" TEXT,
    "acceptedAt" DATETIME,
    "acceptedBy" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "contractId" TEXT,
    CONSTRAINT "ContractRequest_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractRequestBudgetItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractRequestBudgetItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ContractRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractRequestBudgetItem_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractRequestProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "normalizedCnpj" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "originalProposalValue" DECIMAL,
    "proposalValue" DECIMAL NOT NULL,
    "notes" TEXT,
    "suggestedWinner" BOOLEAN NOT NULL DEFAULT false,
    "rowNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractRequestProposal_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionBaselineSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "index" TEXT NOT NULL,
    "plannedStart" DATETIME,
    "plannedEnd" DATETIME,
    "plannedWeight" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConstructionBaselineSchedule_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionBaselineSchedule_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ConstructionImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionBaselineSchedule_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionScheduleRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "index" TEXT NOT NULL,
    "version" TEXT,
    "replannedStart" DATETIME,
    "replannedEnd" DATETIME,
    "revisionDate" DATETIME,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConstructionScheduleRevision_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionScheduleRevision_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ConstructionImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionScheduleRevision_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "revisionDate" DATETIME,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleVersion_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleVersionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "index" TEXT NOT NULL,
    "baselineStart" DATETIME,
    "baselineEnd" DATETIME,
    "baselineWeight" DECIMAL,
    "replannedStart" DATETIME,
    "replannedEnd" DATETIME,
    "deltaDays" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleVersionItem_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScheduleVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleVersionItem_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstructionWork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "address" TEXT,
    "structuredAddressId" TEXT,
    "clientName" TEXT,
    "baseDate" DATETIME,
    "plannedStart" DATETIME,
    "plannedEnd" DATETIME,
    "activeImportId" TEXT,
    "areaM2" DECIMAL,
    "operationalStatus" TEXT,
    "responsibleName" TEXT,
    "bdiPercentage" DECIMAL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConstructionWork_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConstructionWork_structuredAddressId_fkey" FOREIGN KEY ("structuredAddressId") REFERENCES "Address" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkCreationIdempotency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkCreationIdempotency_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhotoReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PhotoReport_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConstructionBudgetItem_ownerId_workId_idx" ON "ConstructionBudgetItem"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "ConstructionBudgetItem_importId_idx" ON "ConstructionBudgetItem"("importId");

-- CreateIndex
CREATE INDEX "ConstructionBudgetItem_parentId_idx" ON "ConstructionBudgetItem"("parentId");

-- CreateIndex
CREATE INDEX "ConstructionBudgetItem_workId_sortOrder_idx" ON "ConstructionBudgetItem"("workId", "sortOrder");

-- CreateIndex
CREATE INDEX "ConstructionBudgetItem_ownerId_workId_importId_idx" ON "ConstructionBudgetItem"("ownerId", "workId", "importId");

-- CreateIndex
CREATE INDEX "ConstructionBudgetItem_identityId_idx" ON "ConstructionBudgetItem"("identityId");

-- CreateIndex
CREATE INDEX "BudgetVersion_ownerId_workId_idx" ON "BudgetVersion"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "BudgetVersion_workId_status_idx" ON "BudgetVersion"("workId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetVersion_workId_versionNumber_key" ON "BudgetVersion"("workId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetVersion_workId_label_key" ON "BudgetVersion"("workId", "label");

-- CreateIndex
CREATE INDEX "BudgetItemIdentity_ownerId_workId_idx" ON "BudgetItemIdentity"("ownerId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetItemIdentity_workId_index_key" ON "BudgetItemIdentity"("workId", "index");

-- CreateIndex
CREATE INDEX "BudgetVersionItem_identityId_idx" ON "BudgetVersionItem"("identityId");

-- CreateIndex
CREATE INDEX "BudgetVersionItem_versionId_parentVersionId_idx" ON "BudgetVersionItem"("versionId", "parentVersionId");

-- CreateIndex
CREATE INDEX "BudgetVersionItem_versionId_parentVersionId_index_idx" ON "BudgetVersionItem"("versionId", "parentVersionId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetVersionItem_versionId_identityId_key" ON "BudgetVersionItem"("versionId", "identityId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetVersionItem_versionId_index_key" ON "BudgetVersionItem"("versionId", "index");

-- CreateIndex
CREATE INDEX "ConstructionBudgetReconciliation_ownerId_workId_status_idx" ON "ConstructionBudgetReconciliation"("ownerId", "workId", "status");

-- CreateIndex
CREATE INDEX "ConstructionBudgetReconciliation_ownerId_status_idx" ON "ConstructionBudgetReconciliation"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionBudgetReconciliation_sourceType_sourceId_key" ON "ConstructionBudgetReconciliation"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetProjectionState_workId_key" ON "BudgetProjectionState"("workId");

-- CreateIndex
CREATE INDEX "BudgetProjectionState_ownerId_status_idx" ON "BudgetProjectionState"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetProjectionOutbox_idempotencyKey_key" ON "BudgetProjectionOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BudgetProjectionOutbox_ownerId_status_availableAt_idx" ON "BudgetProjectionOutbox"("ownerId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "BudgetProjectionOutbox_workId_sourceVersionId_idx" ON "BudgetProjectionOutbox"("workId", "sourceVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractRequestId_key" ON "Contract"("contractRequestId");

-- CreateIndex
CREATE INDEX "Contract_ownerId_workId_idx" ON "Contract"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "Contract_ownerId_idx" ON "Contract"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_ownerId_workId_code_key" ON "Contract"("ownerId", "workId", "code");

-- CreateIndex
CREATE INDEX "ContractInstrumentArtifact_ownerId_contractId_idx" ON "ContractInstrumentArtifact"("ownerId", "contractId");

-- CreateIndex
CREATE INDEX "ContractInstrumentArtifact_ownerId_sha256_idx" ON "ContractInstrumentArtifact"("ownerId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ContractInstrumentArtifact_contractId_key" ON "ContractInstrumentArtifact"("contractId");

-- CreateIndex
CREATE INDEX "ContractService_contractId_idx" ON "ContractService"("contractId");

-- CreateIndex
CREATE INDEX "ContractService_parentId_idx" ON "ContractService"("parentId");

-- CreateIndex
CREATE INDEX "ContractMeasurement_ownerId_contractId_idx" ON "ContractMeasurement"("ownerId", "contractId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractMeasurement_ownerId_contractId_number_key" ON "ContractMeasurement"("ownerId", "contractId", "number");

-- CreateIndex
CREATE INDEX "ContractMeasurementItem_measurementId_idx" ON "ContractMeasurementItem"("measurementId");

-- CreateIndex
CREATE INDEX "ContractMeasurementItem_serviceId_idx" ON "ContractMeasurementItem"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractMeasurementItem_measurementId_serviceId_key" ON "ContractMeasurementItem"("measurementId", "serviceId");

-- CreateIndex
CREATE INDEX "ContractPayment_ownerId_contractId_idx" ON "ContractPayment"("ownerId", "contractId");

-- CreateIndex
CREATE INDEX "ContractPayment_contractId_idx" ON "ContractPayment"("contractId");

-- CreateIndex
CREATE INDEX "ContractPayment_measurementId_idx" ON "ContractPayment"("measurementId");

-- CreateIndex
CREATE INDEX "ContractFolder_contractId_idx" ON "ContractFolder"("contractId");

-- CreateIndex
CREATE INDEX "ContractFile_folderId_idx" ON "ContractFile"("folderId");

-- CreateIndex
CREATE INDEX "ConstructionContractAmendment_ownerId_contractId_idx" ON "ConstructionContractAmendment"("ownerId", "contractId");

-- CreateIndex
CREATE INDEX "ContractAmendmentMeasurement_ownerId_amendmentId_idx" ON "ContractAmendmentMeasurement"("ownerId", "amendmentId");

-- CreateIndex
CREATE INDEX "ContractAmendmentMeasurement_ownerId_measurementId_idx" ON "ContractAmendmentMeasurement"("ownerId", "measurementId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractAmendmentMeasurement_amendmentId_measurementId_key" ON "ContractAmendmentMeasurement"("amendmentId", "measurementId");

-- CreateIndex
CREATE INDEX "ConstructionMeasurement_ownerId_workId_idx" ON "ConstructionMeasurement"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "ConstructionMeasurement_workId_importId_idx" ON "ConstructionMeasurement"("workId", "importId");

-- CreateIndex
CREATE INDEX "ConstructionMeasurement_importId_idx" ON "ConstructionMeasurement"("importId");

-- CreateIndex
CREATE INDEX "ConstructionMeasurement_budgetItemId_idx" ON "ConstructionMeasurement"("budgetItemId");

-- CreateIndex
CREATE INDEX "ConstructionActualCost_ownerId_workId_idx" ON "ConstructionActualCost"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "ConstructionActualCost_workId_importId_idx" ON "ConstructionActualCost"("workId", "importId");

-- CreateIndex
CREATE INDEX "ConstructionActualCost_importId_idx" ON "ConstructionActualCost"("importId");

-- CreateIndex
CREATE INDEX "ConstructionActualCost_budgetItemId_idx" ON "ConstructionActualCost"("budgetItemId");

-- CreateIndex
CREATE INDEX "ConstructionActualCost_budgetVersionItemId_idx" ON "ConstructionActualCost"("budgetVersionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CostMigrationLineage_lineageKey_key" ON "CostMigrationLineage"("lineageKey");

-- CreateIndex
CREATE INDEX "CostMigrationLineage_ownerId_sourceCostId_idx" ON "CostMigrationLineage"("ownerId", "sourceCostId");

-- CreateIndex
CREATE UNIQUE INDEX "CostMigrationLineage_sourceCostId_sequence_key" ON "CostMigrationLineage"("sourceCostId", "sequence");

-- CreateIndex
CREATE INDEX "ActualCostAllocation_actualCostId_idx" ON "ActualCostAllocation"("actualCostId");

-- CreateIndex
CREATE INDEX "ActualCostAllocation_budgetItemId_idx" ON "ActualCostAllocation"("budgetItemId");

-- CreateIndex
CREATE INDEX "ActualCostAllocation_ownerId_idx" ON "ActualCostAllocation"("ownerId");

-- CreateIndex
CREATE INDEX "WorkMeasurement_ownerId_workId_idx" ON "WorkMeasurement"("ownerId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkMeasurement_ownerId_workId_number_key" ON "WorkMeasurement"("ownerId", "workId", "number");

-- CreateIndex
CREATE INDEX "WorkMeasurementItem_measurementId_idx" ON "WorkMeasurementItem"("measurementId");

-- CreateIndex
CREATE INDEX "WorkMeasurementItem_budgetItemId_idx" ON "WorkMeasurementItem"("budgetItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkMeasurementItem_measurementId_budgetItemId_key" ON "WorkMeasurementItem"("measurementId", "budgetItemId");

-- CreateIndex
CREATE INDEX "ConstructionMeasurementCoverage_ownerId_idx" ON "ConstructionMeasurementCoverage"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionMeasurementCoverage_workMeasurementItemId_contractMeasurementItemId_key" ON "ConstructionMeasurementCoverage"("workMeasurementItemId", "contractMeasurementItemId");

-- CreateIndex
CREATE INDEX "GovernanceRecord_ownerId_status_idx" ON "GovernanceRecord"("ownerId", "status");

-- CreateIndex
CREATE INDEX "GovernanceRecord_entityType_entityId_idx" ON "GovernanceRecord"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "GovernanceRecord_changedBy_idx" ON "GovernanceRecord"("changedBy");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceRecord_ownerId_entityType_entityId_key" ON "GovernanceRecord"("ownerId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ApprovalPolicy_scopeType_scopeId_action_active_idx" ON "ApprovalPolicy"("scopeType", "scopeId", "action", "active");

-- CreateIndex
CREATE INDEX "ApprovalPolicy_subjectType_subjectId_idx" ON "ApprovalPolicy"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ApprovalPolicy_ownerId_idx" ON "ApprovalPolicy"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPolicy_scopeType_scopeId_subjectType_subjectId_action_mode_key" ON "ApprovalPolicy"("scopeType", "scopeId", "subjectType", "subjectId", "action", "mode");

-- CreateIndex
CREATE INDEX "ApprovalRequest_ownerId_status_idx" ON "ApprovalRequest"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_resourceType_resourceId_idx" ON "ApprovalRequest"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_actorId_idx" ON "ApprovalRequest"("actorId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_requiredApproverRole_organizationId_costCenterId_idx" ON "ApprovalRequest"("status", "requiredApproverRole", "organizationId", "costCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_effectAction_resourceId_idempotencyKey_key" ON "ApprovalRequest"("effectAction", "resourceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalReversalRequest_requestId_key" ON "ApprovalReversalRequest"("requestId");

-- CreateIndex
CREATE INDEX "ApprovalReversalRequest_requestId_idx" ON "ApprovalReversalRequest"("requestId");

-- CreateIndex
CREATE INDEX "ApprovalReversalRequest_actorId_idx" ON "ApprovalReversalRequest"("actorId");

-- CreateIndex
CREATE INDEX "ApprovalDecision_approverId_idx" ON "ApprovalDecision"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalDecision_requestId_key" ON "ApprovalDecision"("requestId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_status_idx" ON "Notification"("recipientId", "status");

-- CreateIndex
CREATE INDEX "Notification_referenceId_idx" ON "Notification"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientId_eventType_referenceId_version_key" ON "Notification"("recipientId", "eventType", "referenceId", "version");

-- CreateIndex
CREATE INDEX "AuditLog_ownerId_idx" ON "AuditLog"("ownerId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityDescription_idx" ON "AuditLog"("entityDescription");

-- CreateIndex
CREATE INDEX "AuditComment_ownerId_workId_createdAt_idx" ON "AuditComment"("ownerId", "workId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditComment_ownerId_auditLogId_idx" ON "AuditComment"("ownerId", "auditLogId");

-- CreateIndex
CREATE INDEX "AuditComment_authorId_idx" ON "AuditComment"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserScopeGrant_userId_revokedAt_idx" ON "UserScopeGrant"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "UserScopeGrant_scopeType_scopeId_idx" ON "UserScopeGrant"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserScopeGrant_userId_scopeType_scopeId_key" ON "UserScopeGrant"("userId", "scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_tokenHash_key" ON "UserInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "UserInvitation_scopeType_scopeId_idx" ON "UserInvitation"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "UserInvitation_email_idx" ON "UserInvitation"("email");

-- CreateIndex
CREATE INDEX "UserInvitation_revokedAt_idx" ON "UserInvitation"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Account_providerId_accountId_idx" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_expiresAt_idx" ON "Verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_identifier_value_key" ON "Verification"("identifier", "value");

-- CreateIndex
CREATE INDEX "ApiKey_ownerId_idx" ON "ApiKey"("ownerId");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyPrefix_key" ON "ApiKey"("keyPrefix");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "CostCenterMembership_costCenterId_idx" ON "CostCenterMembership"("costCenterId");

-- CreateIndex
CREATE INDEX "CostCenterMembership_userId_idx" ON "CostCenterMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenterMembership_costCenterId_userId_key" ON "CostCenterMembership"("costCenterId", "userId");

-- CreateIndex
CREATE INDEX "WorkMembership_workId_idx" ON "WorkMembership"("workId");

-- CreateIndex
CREATE INDEX "WorkMembership_userId_idx" ON "WorkMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkMembership_workId_userId_key" ON "WorkMembership"("workId", "userId");

-- CreateIndex
CREATE INDEX "ConstructionImport_ownerId_idx" ON "ConstructionImport"("ownerId");

-- CreateIndex
CREATE INDEX "ConstructionImport_workId_idx" ON "ConstructionImport"("workId");

-- CreateIndex
CREATE INDEX "ConstructionImport_createdAt_idx" ON "ConstructionImport"("createdAt");

-- CreateIndex
CREATE INDEX "ConstructionImport_ownerId_workId_reprocessOfId_idx" ON "ConstructionImport"("ownerId", "workId", "reprocessOfId");

-- CreateIndex
CREATE INDEX "ImportBatch_ownerId_status_idx" ON "ImportBatch"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ImportBatch_ownerId_workId_idx" ON "ImportBatch"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "ImportBatch_fileSha256_idx" ON "ImportBatch"("fileSha256");

-- CreateIndex
CREATE INDEX "ImportBatch_reprocessOfId_idx" ON "ImportBatch"("reprocessOfId");

-- CreateIndex
CREATE INDEX "ImportBatch_ownerId_quotationId_idx" ON "ImportBatch"("ownerId", "quotationId");

-- CreateIndex
CREATE INDEX "ImportBatch_ownerId_contractRequestId_idx" ON "ImportBatch"("ownerId", "contractRequestId");

-- CreateIndex
CREATE INDEX "ImportRow_batchId_status_idx" ON "ImportRow"("batchId", "status");

-- CreateIndex
CREATE INDEX "ImportRow_batchId_sheet_rowNumber_idx" ON "ImportRow"("batchId", "sheet", "rowNumber");

-- CreateIndex
CREATE INDEX "ConstructionLedgerEvent_ownerId_workId_competence_idx" ON "ConstructionLedgerEvent"("ownerId", "workId", "competence");

-- CreateIndex
CREATE INDEX "ConstructionLedgerEvent_sourceType_sourceId_idx" ON "ConstructionLedgerEvent"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ConstructionLedgerEvent_budgetItemIdentityId_idx" ON "ConstructionLedgerEvent"("budgetItemIdentityId");

-- CreateIndex
CREATE INDEX "ConstructionLedgerEvent_budgetVersionItemId_idx" ON "ConstructionLedgerEvent"("budgetVersionItemId");

-- CreateIndex
CREATE INDEX "ConstructionLedgerEvent_approvalDecisionId_idx" ON "ConstructionLedgerEvent"("approvalDecisionId");

-- CreateIndex
CREATE INDEX "ConstructionLedgerEvent_budgetImpactId_idx" ON "ConstructionLedgerEvent"("budgetImpactId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionLedgerEvent_eventType_sourceType_sourceId_componentId_key" ON "ConstructionLedgerEvent"("eventType", "sourceType", "sourceId", "componentId");

-- CreateIndex
CREATE INDEX "ConstructionBudgetImpact_ownerId_workId_budgetItemIdentityId_status_idx" ON "ConstructionBudgetImpact"("ownerId", "workId", "budgetItemIdentityId", "status");

-- CreateIndex
CREATE INDEX "ConstructionBudgetImpact_sourceType_sourceId_idx" ON "ConstructionBudgetImpact"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ConstructionBudgetImpact_budgetItemIdentityId_idx" ON "ConstructionBudgetImpact"("budgetItemIdentityId");

-- CreateIndex
CREATE INDEX "ConstructionBudgetImpact_budgetVersionItemId_idx" ON "ConstructionBudgetImpact"("budgetVersionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionBudgetImpact_sourceType_sourceId_componentId_impactType_budgetVersionItemId_key" ON "ConstructionBudgetImpact"("sourceType", "sourceId", "componentId", "impactType", "budgetVersionItemId");

-- CreateIndex
CREATE INDEX "ConstructionMonthlyFact_ownerId_workId_competencia_idx" ON "ConstructionMonthlyFact"("ownerId", "workId", "competencia");

-- CreateIndex
CREATE INDEX "ConstructionMonthlyFact_ownerId_status_idx" ON "ConstructionMonthlyFact"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ConstructionMonthlyFact_fingerprint_idx" ON "ConstructionMonthlyFact"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionMonthlyFact_ownerId_workId_competencia_origem_version_key" ON "ConstructionMonthlyFact"("ownerId", "workId", "competencia", "origem", "version");

-- CreateIndex
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");

-- CreateIndex
CREATE INDEX "Company_structuredAddressId_idx" ON "Company"("structuredAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_ownerId_name_key" ON "Company"("ownerId", "name");

-- CreateIndex
CREATE INDEX "Address_zipCode_idx" ON "Address"("zipCode");

-- CreateIndex
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");

-- CreateIndex
CREATE INDEX "Organization_companyId_idx" ON "Organization"("companyId");

-- CreateIndex
CREATE INDEX "Organization_structuredAddressId_idx" ON "Organization"("structuredAddressId");

-- CreateIndex
CREATE INDEX "CostCenter_organizationId_ownerId_idx" ON "CostCenter"("organizationId", "ownerId");

-- CreateIndex
CREATE INDEX "CostCenter_organizationId_idx" ON "CostCenter"("organizationId");

-- CreateIndex
CREATE INDEX "CostCenter_structuredAddressId_idx" ON "CostCenter"("structuredAddressId");

-- CreateIndex
CREATE INDEX "ConstructionSupplier_ownerId_name_idx" ON "ConstructionSupplier"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionSupplier_ownerId_document_key" ON "ConstructionSupplier"("ownerId", "document");

-- CreateIndex
CREATE INDEX "ConstructionWorkSupplier_ownerId_workId_idx" ON "ConstructionWorkSupplier"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "ConstructionWorkSupplier_ownerId_supplierId_idx" ON "ConstructionWorkSupplier"("ownerId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionWorkSupplier_workId_supplierId_key" ON "ConstructionWorkSupplier"("workId", "supplierId");

-- CreateIndex
CREATE INDEX "Quotation_ownerId_workId_idx" ON "Quotation"("ownerId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_ownerId_workId_title_key" ON "Quotation"("ownerId", "workId", "title");

-- CreateIndex
CREATE INDEX "QuotationBudgetItem_ownerId_workId_idx" ON "QuotationBudgetItem"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "QuotationBudgetItem_quotationId_idx" ON "QuotationBudgetItem"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationBudgetItem_budgetItemId_idx" ON "QuotationBudgetItem"("budgetItemId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationBudgetItem_quotationId_budgetItemId_key" ON "QuotationBudgetItem"("quotationId", "budgetItemId");

-- CreateIndex
CREATE INDEX "QuotationProposal_quotationId_supplierDocument_idx" ON "QuotationProposal"("quotationId", "supplierDocument");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationProposal_quotationId_supplierName_key" ON "QuotationProposal"("quotationId", "supplierName");

-- CreateIndex
CREATE INDEX "QuotationRound_quotationId_createdAt_idx" ON "QuotationRound"("quotationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationRound_quotationId_roundNumber_key" ON "QuotationRound"("quotationId", "roundNumber");

-- CreateIndex
CREATE INDEX "ProposalNegotiationEvent_roundId_createdAt_idx" ON "ProposalNegotiationEvent"("roundId", "createdAt");

-- CreateIndex
CREATE INDEX "ProposalNegotiationEvent_proposalId_createdAt_idx" ON "ProposalNegotiationEvent"("proposalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRequest_contractId_key" ON "ContractRequest"("contractId");

-- CreateIndex
CREATE INDEX "ContractRequest_ownerId_workId_status_idx" ON "ContractRequest"("ownerId", "workId", "status");

-- CreateIndex
CREATE INDEX "ContractRequest_ownerId_workId_idx" ON "ContractRequest"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "ContractRequestBudgetItem_ownerId_workId_idx" ON "ContractRequestBudgetItem"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "ContractRequestBudgetItem_budgetItemId_idx" ON "ContractRequestBudgetItem"("budgetItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRequestBudgetItem_requestId_budgetItemId_key" ON "ContractRequestBudgetItem"("requestId", "budgetItemId");

-- CreateIndex
CREATE INDEX "ContractRequestProposal_ownerId_workId_idx" ON "ContractRequestProposal"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "ContractRequestProposal_batchId_idx" ON "ContractRequestProposal"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRequestProposal_batchId_normalizedCnpj_key" ON "ContractRequestProposal"("batchId", "normalizedCnpj");

-- CreateIndex
CREATE INDEX "ConstructionBaselineSchedule_ownerId_workId_idx" ON "ConstructionBaselineSchedule"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "ConstructionBaselineSchedule_workId_importId_idx" ON "ConstructionBaselineSchedule"("workId", "importId");

-- CreateIndex
CREATE INDEX "ConstructionBaselineSchedule_importId_idx" ON "ConstructionBaselineSchedule"("importId");

-- CreateIndex
CREATE INDEX "ConstructionBaselineSchedule_budgetItemId_idx" ON "ConstructionBaselineSchedule"("budgetItemId");

-- CreateIndex
CREATE INDEX "ConstructionScheduleRevision_ownerId_workId_idx" ON "ConstructionScheduleRevision"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "ConstructionScheduleRevision_workId_importId_idx" ON "ConstructionScheduleRevision"("workId", "importId");

-- CreateIndex
CREATE INDEX "ConstructionScheduleRevision_importId_idx" ON "ConstructionScheduleRevision"("importId");

-- CreateIndex
CREATE INDEX "ConstructionScheduleRevision_budgetItemId_idx" ON "ConstructionScheduleRevision"("budgetItemId");

-- CreateIndex
CREATE INDEX "ScheduleVersion_ownerId_workId_idx" ON "ScheduleVersion"("ownerId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleVersion_workId_versionNumber_key" ON "ScheduleVersion"("workId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleVersion_workId_label_key" ON "ScheduleVersion"("workId", "label");

-- CreateIndex
CREATE INDEX "ScheduleVersionItem_versionId_idx" ON "ScheduleVersionItem"("versionId");

-- CreateIndex
CREATE INDEX "ScheduleVersionItem_budgetItemId_idx" ON "ScheduleVersionItem"("budgetItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleVersionItem_versionId_index_key" ON "ScheduleVersionItem"("versionId", "index");

-- CreateIndex
CREATE INDEX "ConstructionWork_ownerId_idx" ON "ConstructionWork"("ownerId");

-- CreateIndex
CREATE INDEX "ConstructionWork_ownerId_name_idx" ON "ConstructionWork"("ownerId", "name");

-- CreateIndex
CREATE INDEX "ConstructionWork_costCenterId_idx" ON "ConstructionWork"("costCenterId");

-- CreateIndex
CREATE INDEX "ConstructionWork_structuredAddressId_idx" ON "ConstructionWork"("structuredAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionWork_ownerId_code_key" ON "ConstructionWork"("ownerId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkCreationIdempotency_workId_key" ON "WorkCreationIdempotency"("workId");

-- CreateIndex
CREATE INDEX "WorkCreationIdempotency_ownerId_idx" ON "WorkCreationIdempotency"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkCreationIdempotency_ownerId_key_key" ON "WorkCreationIdempotency"("ownerId", "key");

-- CreateIndex
CREATE INDEX "PhotoReport_ownerId_workId_idx" ON "PhotoReport"("ownerId", "workId");

-- CreateIndex
CREATE INDEX "PhotoReport_workId_idx" ON "PhotoReport"("workId");

-- CreateIndex
CREATE INDEX "PhotoReport_createdAt_idx" ON "PhotoReport"("createdAt");
