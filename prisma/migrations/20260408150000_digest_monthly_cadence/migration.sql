-- AlterTable
ALTER TABLE "WorkspaceDigestSettings"
ADD COLUMN "dayOfMonth" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ProjectDigestSettings"
ADD COLUMN "dayOfMonth" INTEGER NOT NULL DEFAULT 1;
