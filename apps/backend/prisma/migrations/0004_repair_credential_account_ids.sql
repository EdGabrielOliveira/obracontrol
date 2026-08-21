-- Better Auth identifies credential accounts by the stable user id.
-- Older provisioning paths used the email address, which made sign-in
-- unable to resolve the credential account after admin/user creation.
UPDATE "Account"
SET "accountId" = "userId"
WHERE "providerId" = 'credential'
  AND "accountId" <> "userId";
