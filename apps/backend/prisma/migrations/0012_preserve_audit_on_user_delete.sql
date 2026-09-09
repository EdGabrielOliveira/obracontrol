-- Audit history must outlive the user who performed the action. Keep the
-- actor id when available and set it to NULL after the user is removed.
PRAGMA foreign_keys = OFF;

CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityDescription" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_AuditLog" (
    "id", "userId", "action", "entityType", "entityId", "entityDescription",
    "previousState", "newState", "metadata", "createdAt", "ownerId"
)
SELECT
    "id", "userId", "action", "entityType", "entityId", "entityDescription",
    "previousState", "newState", "metadata", "createdAt", "ownerId"
FROM "AuditLog";

DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";

CREATE INDEX "AuditLog_ownerId_idx" ON "AuditLog"("ownerId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_entityDescription_idx" ON "AuditLog"("entityDescription");

PRAGMA foreign_keys = ON;
