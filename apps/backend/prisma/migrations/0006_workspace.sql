-- Workspace ownership boundary.  The columns are nullable during the
-- compatibility phase; the backfill script makes them complete before the
-- application starts relying on them for authorization.
CREATE TABLE IF NOT EXISTS "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

ALTER TABLE "User" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "UserInvitation" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Company" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "CostCenter" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ConstructionWork" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "WorkCreationIdempotency" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "PhotoReport" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ConstructionImport" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ConstructionBudgetItem" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "BudgetVersion" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "BudgetItemIdentity" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ConstructionBudgetReconciliation" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "BudgetProjectionState" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "BudgetProjectionOutbox" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Contract" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ContractInstrumentArtifact" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ContractMeasurement" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ContractPayment" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ConstructionContractAmendment" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ContractAmendmentMeasurement" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ConstructionSupplier" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ImportBatch" ADD COLUMN "workspaceId" TEXT;

CREATE INDEX IF NOT EXISTS "User_workspaceId_idx" ON "User"("workspaceId");
CREATE INDEX IF NOT EXISTS "UserInvitation_workspaceId_idx" ON "UserInvitation"("workspaceId");
CREATE INDEX IF NOT EXISTS "Company_workspaceId_idx" ON "Company"("workspaceId");
CREATE INDEX IF NOT EXISTS "Organization_workspaceId_idx" ON "Organization"("workspaceId");
CREATE INDEX IF NOT EXISTS "CostCenter_workspaceId_idx" ON "CostCenter"("workspaceId");
CREATE INDEX IF NOT EXISTS "ConstructionWork_workspaceId_idx" ON "ConstructionWork"("workspaceId");
CREATE INDEX IF NOT EXISTS "ConstructionImport_workspaceId_idx" ON "ConstructionImport"("workspaceId");
CREATE INDEX IF NOT EXISTS "ConstructionBudgetItem_workspaceId_idx" ON "ConstructionBudgetItem"("workspaceId");
CREATE INDEX IF NOT EXISTS "BudgetVersion_workspaceId_idx" ON "BudgetVersion"("workspaceId");
CREATE INDEX IF NOT EXISTS "BudgetItemIdentity_workspaceId_idx" ON "BudgetItemIdentity"("workspaceId");
CREATE INDEX IF NOT EXISTS "ConstructionBudgetReconciliation_workspaceId_idx" ON "ConstructionBudgetReconciliation"("workspaceId");
CREATE INDEX IF NOT EXISTS "BudgetProjectionState_workspaceId_idx" ON "BudgetProjectionState"("workspaceId");
CREATE INDEX IF NOT EXISTS "BudgetProjectionOutbox_workspaceId_idx" ON "BudgetProjectionOutbox"("workspaceId");
CREATE INDEX IF NOT EXISTS "Contract_workspaceId_idx" ON "Contract"("workspaceId");
CREATE INDEX IF NOT EXISTS "ContractInstrumentArtifact_workspaceId_idx" ON "ContractInstrumentArtifact"("workspaceId");
CREATE INDEX IF NOT EXISTS "ContractMeasurement_workspaceId_idx" ON "ContractMeasurement"("workspaceId");
CREATE INDEX IF NOT EXISTS "ContractPayment_workspaceId_idx" ON "ContractPayment"("workspaceId");
CREATE INDEX IF NOT EXISTS "ConstructionContractAmendment_workspaceId_idx" ON "ConstructionContractAmendment"("workspaceId");
CREATE INDEX IF NOT EXISTS "ContractAmendmentMeasurement_workspaceId_idx" ON "ContractAmendmentMeasurement"("workspaceId");
CREATE INDEX IF NOT EXISTS "ConstructionSupplier_workspaceId_idx" ON "ConstructionSupplier"("workspaceId");
CREATE INDEX IF NOT EXISTS "ImportBatch_workspaceId_idx" ON "ImportBatch"("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "Company_workspaceId_name_key" ON "Company"("workspaceId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_workspaceId_name_key" ON "Organization"("workspaceId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "ConstructionWork_workspaceId_code_key" ON "ConstructionWork"("workspaceId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "ConstructionSupplier_workspaceId_document_key" ON "ConstructionSupplier"("workspaceId", "document");
DROP INDEX IF EXISTS "Company_ownerId_name_key";
DROP INDEX IF EXISTS "ConstructionWork_ownerId_code_key";
DROP INDEX IF EXISTS "ConstructionSupplier_ownerId_document_key";
