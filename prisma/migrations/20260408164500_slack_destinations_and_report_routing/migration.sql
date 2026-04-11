-- CreateTable
CREATE TABLE "WorkspaceSlackDestination" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "webhookUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceSlackDestination_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "WorkspaceDigestSettings"
ADD COLUMN "slackDestinationId" TEXT;

-- AlterTable
ALTER TABLE "ProjectDigestSettings"
ADD COLUMN "slackDestinationId" TEXT;

-- AlterTable
ALTER TABLE "RecurringReportTemplate"
ADD COLUMN "slackDestinationId" TEXT;

-- CreateIndex
CREATE INDEX "WorkspaceSlackDestination_workspaceId_createdAt_idx"
ON "WorkspaceSlackDestination"("workspaceId", "createdAt");

-- ForeignKey
ALTER TABLE "WorkspaceSlackDestination"
ADD CONSTRAINT "WorkspaceSlackDestination_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ForeignKey
ALTER TABLE "WorkspaceDigestSettings"
ADD CONSTRAINT "WorkspaceDigestSettings_slackDestinationId_fkey"
FOREIGN KEY ("slackDestinationId") REFERENCES "WorkspaceSlackDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ForeignKey
ALTER TABLE "ProjectDigestSettings"
ADD CONSTRAINT "ProjectDigestSettings_slackDestinationId_fkey"
FOREIGN KEY ("slackDestinationId") REFERENCES "WorkspaceSlackDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ForeignKey
ALTER TABLE "RecurringReportTemplate"
ADD CONSTRAINT "RecurringReportTemplate_slackDestinationId_fkey"
FOREIGN KEY ("slackDestinationId") REFERENCES "WorkspaceSlackDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
