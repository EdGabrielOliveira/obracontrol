-- A cost is a business aggregate with one or more financial cost items.
CREATE TABLE "ConstructionCost" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "importId" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionCost_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ConstructionActualCost" ADD COLUMN "costId" TEXT;

-- Preserve existing records: each legacy line becomes a one-item aggregate.
INSERT INTO "ConstructionCost" (
    "id", "ownerId", "workId", "importId", "title", "createdAt", "updatedAt"
)
SELECT
    "id",
    "ownerId",
    "workId",
    "importId",
    COALESCE(NULLIF(BTRIM("title"), ''), NULLIF(BTRIM("description"), ''), 'Custo realizado'),
    "createdAt",
    "updatedAt"
FROM "ConstructionActualCost";

UPDATE "ConstructionActualCost" SET "costId" = "id" WHERE "costId" IS NULL;

CREATE INDEX "ConstructionCost_ownerId_workId_idx" ON "ConstructionCost"("ownerId", "workId");
CREATE INDEX "ConstructionCost_workId_importId_idx" ON "ConstructionCost"("workId", "importId");
CREATE INDEX "ConstructionCost_importId_idx" ON "ConstructionCost"("importId");
CREATE INDEX "ConstructionActualCost_costId_idx" ON "ConstructionActualCost"("costId");

ALTER TABLE "ConstructionCost" ADD CONSTRAINT "ConstructionCost_workId_fkey"
    FOREIGN KEY ("workId") REFERENCES "ConstructionWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructionCost" ADD CONSTRAINT "ConstructionCost_importId_fkey"
    FOREIGN KEY ("importId") REFERENCES "ConstructionImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructionActualCost" ADD CONSTRAINT "ConstructionActualCost_costId_fkey"
    FOREIGN KEY ("costId") REFERENCES "ConstructionCost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
