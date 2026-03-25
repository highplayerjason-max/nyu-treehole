-- Remove email verification system
-- emailVerified was always set to true on registration and never checked
-- VerificationToken table was never used in the active auth flow

ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerified";

DROP TABLE IF EXISTS "VerificationToken";
