ALTER TABLE "ConstructionWork" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "ConstructionWork" ADD COLUMN "statusChangedAt" DATETIME;
ALTER TABLE "ConstructionWork" ADD COLUMN "statusChangedBy" TEXT;

ALTER TABLE "Contract" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "Contract" ADD COLUMN "statusChangedAt" DATETIME;
ALTER TABLE "Contract" ADD COLUMN "statusChangedBy" TEXT;

ALTER TABLE "WorkMeasurement" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'RASCUNHO';
ALTER TABLE "WorkMeasurement" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "WorkMeasurement" ADD COLUMN "archivedBy" TEXT;
ALTER TABLE "WorkMeasurement" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "WorkMeasurement" ADD COLUMN "statusChangedAt" DATETIME;

ALTER TABLE "ContractMeasurement" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'RASCUNHO';
ALTER TABLE "ContractMeasurement" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "ContractMeasurement" ADD COLUMN "archivedBy" TEXT;
ALTER TABLE "ContractMeasurement" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "ContractMeasurement" ADD COLUMN "statusChangedAt" DATETIME;

-- Registros antigos de importação já eram a fonte operacional validada.
-- Normaliza-os como aceitos antes de aplicar o filtro de status nos cálculos.
UPDATE "ConstructionMeasurement" SET "status" = 'ACEITO' WHERE "status" IS NULL;

-- Medições criadas antes do lifecycle também já participavam dos cálculos.
-- O DEFAULT atende somente novas linhas; as linhas legadas precisam continuar
-- aceitas para não desaparecerem dos saldos e indicadores históricos.
UPDATE "WorkMeasurement" SET "status" = 'ACEITO' WHERE "status" = 'RASCUNHO';
UPDATE "ContractMeasurement" SET "status" = 'ACEITO' WHERE "status" = 'RASCUNHO';
