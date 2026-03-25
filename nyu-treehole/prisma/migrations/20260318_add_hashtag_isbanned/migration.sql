-- Add isBanned column to Hashtag table
ALTER TABLE "Hashtag" ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false;
