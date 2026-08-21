-- R2-backed artifacts do not carry their payload in D1. Rebuild the table so
-- legacy byte payloads remain readable while new rows can use storageKey only.
PRAGMA foreign_keys = OFF;
CREATE TABLE "ContractInstrumentArtifact_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BLOB,
    "sha256" TEXT NOT NULL,
    "templateSha256" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageKey" TEXT,
    CONSTRAINT "ContractInstrumentArtifact_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "ContractInstrumentArtifact_new" ("id", "ownerId", "contractId", "version", "filename", "mimeType", "bytes", "sha256", "templateSha256", "catalogVersion", "generatedBy", "generatedAt", "storageKey")
SELECT "id", "ownerId", "contractId", "version", "filename", "mimeType", "bytes", "sha256", "templateSha256", "catalogVersion", "generatedBy", "generatedAt", "storageKey"
FROM "ContractInstrumentArtifact";
DROP TABLE "ContractInstrumentArtifact";
ALTER TABLE "ContractInstrumentArtifact_new" RENAME TO "ContractInstrumentArtifact";
CREATE INDEX "ContractInstrumentArtifact_ownerId_contractId_idx" ON "ContractInstrumentArtifact"("ownerId", "contractId");
CREATE INDEX "ContractInstrumentArtifact_ownerId_sha256_idx" ON "ContractInstrumentArtifact"("ownerId", "sha256");
CREATE UNIQUE INDEX "ContractInstrumentArtifact_contractId_key" ON "ContractInstrumentArtifact"("contractId");
PRAGMA foreign_keys = ON;
