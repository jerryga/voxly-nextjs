-- AlterTable
ALTER TABLE "WorkspaceDigestSettings"
ADD COLUMN "sendEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sendSlack" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProjectDigestSettings"
ADD COLUMN "sendEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sendSlack" BOOLEAN NOT NULL DEFAULT false;
