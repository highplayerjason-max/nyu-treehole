-- Add email verification back in a link-based form
-- Existing users are marked verified so they do not get locked out

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN;

UPDATE "User"
SET "emailVerified" = true
WHERE "emailVerified" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "emailVerified" SET DEFAULT false;

ALTER TABLE "User"
  ALTER COLUMN "emailVerified" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key"
  ON "EmailVerificationToken"("tokenHash");

CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx"
  ON "EmailVerificationToken"("userId");

CREATE INDEX IF NOT EXISTS "EmailVerificationToken_expiresAt_idx"
  ON "EmailVerificationToken"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'EmailVerificationToken_userId_fkey'
      AND table_name = 'EmailVerificationToken'
  ) THEN
    ALTER TABLE "EmailVerificationToken"
      ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
