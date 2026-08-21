-- Better Auth 1.7 scopes account identity by issuer. Credential accounts
-- use the local:credential issuer and must carry it for sign-in lookup.
ALTER TABLE "Account" ADD COLUMN "issuer" TEXT;

UPDATE "Account"
SET "issuer" = 'local:credential'
WHERE "providerId" = 'credential'
  AND "issuer" IS NULL;
