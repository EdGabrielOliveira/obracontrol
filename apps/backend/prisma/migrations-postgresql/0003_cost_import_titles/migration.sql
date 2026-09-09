-- Group imported and manually created cost items under a user-facing title.
ALTER TABLE "ConstructionImport" ADD COLUMN "title" TEXT;
ALTER TABLE "ConstructionActualCost" ADD COLUMN "title" TEXT;
