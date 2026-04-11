-- AlterTable
ALTER TABLE "WorkspaceDigestSettings"
ADD COLUMN "reportType" TEXT NOT NULL DEFAULT 'summary';

-- AlterTable
ALTER TABLE "ProjectDigestSettings"
ADD COLUMN "reportType" TEXT NOT NULL DEFAULT 'summary';
