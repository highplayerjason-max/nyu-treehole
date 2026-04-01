-- CreateEnum
CREATE TYPE "CommunityBoard" AS ENUM ('TREEHOLE', 'GYM');

-- CreateEnum
CREATE TYPE "ModerationCaseStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ModerationCaseSource" AS ENUM ('AI', 'REPORT');

-- AlterTable
ALTER TABLE "Hashtag"
ADD COLUMN "scope" "CommunityBoard" NOT NULL DEFAULT 'TREEHOLE';

-- AlterTable
ALTER TABLE "TreeholeComment"
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TreeholePost"
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "TreeholePost"
ADD COLUMN "board" "CommunityBoard" NOT NULL DEFAULT 'TREEHOLE';

-- DropIndex
DROP INDEX "Hashtag_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Hashtag_scope_name_key" ON "Hashtag"("scope", "name");

-- CreateIndex
CREATE INDEX "TreeholePost_board_status_createdAt_idx" ON "TreeholePost"("board", "status", "createdAt");

-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "board" "CommunityBoard",
    "source" "ModerationCaseSource" NOT NULL,
    "status" "ModerationCaseStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModerationCase_contentType_contentId_key" ON "ModerationCase"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "ModerationCase_status_createdAt_idx" ON "ModerationCase"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
