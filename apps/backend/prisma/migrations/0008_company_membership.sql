-- Persistent company-level grants for Gerentes. Existing organization grants
-- are intentionally not promoted to avoid expanding access implicitly.
CREATE TABLE IF NOT EXISTS "CompanyMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GERENTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMembership_companyId_userId_key"
    ON "CompanyMembership"("companyId", "userId");
CREATE INDEX IF NOT EXISTS "CompanyMembership_companyId_idx"
    ON "CompanyMembership"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyMembership_userId_idx"
    ON "CompanyMembership"("userId");
