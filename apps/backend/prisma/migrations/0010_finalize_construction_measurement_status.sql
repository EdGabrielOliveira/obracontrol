-- SQLite cannot alter a column from nullable to NOT NULL in place. Rebuild
-- only this table after 0009 has normalized legacy NULL statuses.
CREATE TABLE "new_ConstructionMeasurement" (
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
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConstructionMeasurement_workId_fkey" FOREIGN KEY ("workId") REFERENCES "ConstructionWork" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionMeasurement_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ConstructionImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConstructionMeasurement_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "ConstructionBudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ConstructionMeasurement" (
    "id", "ownerId", "workId", "importId", "budgetItemId", "rowNumber",
    "index", "title", "measurementDate", "measuredPercentageAccumulated",
    "measuredQuantityAccumulated", "measuredValue", "status", "notes",
    "createdAt", "updatedAt"
)
SELECT
    "id", "ownerId", "workId", "importId", "budgetItemId", "rowNumber",
    "index", "title", "measurementDate", "measuredPercentageAccumulated",
    "measuredQuantityAccumulated", "measuredValue", COALESCE("status", 'ACEITO'), "notes",
    "createdAt", "updatedAt"
FROM "ConstructionMeasurement";

DROP TABLE "ConstructionMeasurement";
ALTER TABLE "new_ConstructionMeasurement" RENAME TO "ConstructionMeasurement";

CREATE INDEX "ConstructionMeasurement_ownerId_workId_idx" ON "ConstructionMeasurement"("ownerId", "workId");
CREATE INDEX "ConstructionMeasurement_workId_importId_idx" ON "ConstructionMeasurement"("workId", "importId");
CREATE INDEX "ConstructionMeasurement_importId_idx" ON "ConstructionMeasurement"("importId");
CREATE INDEX "ConstructionMeasurement_budgetItemId_idx" ON "ConstructionMeasurement"("budgetItemId");
