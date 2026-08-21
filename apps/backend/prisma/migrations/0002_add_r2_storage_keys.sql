-- Large binary payloads live in R2. Legacy columns remain nullable so an
-- import can backfill old data before a later cleanup removes them.
ALTER TABLE "Company" ADD COLUMN "contractTemplateStorageKey" TEXT;
ALTER TABLE "ContractInstrumentArtifact" ADD COLUMN "storageKey" TEXT;
