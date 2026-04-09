CREATE TABLE "RecurringReportRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT,
  "scope" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "cadence" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "recipientScope" TEXT NOT NULL,
  "sendEmail" BOOLEAN NOT NULL DEFAULT true,
  "sendSlack" BOOLEAN NOT NULL DEFAULT false,
  "slackDestinationId" TEXT,
  "emailRecipientCount" INTEGER NOT NULL DEFAULT 0,
  "slackDelivered" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'success',
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecurringReportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringReportRun_workspaceId_createdAt_idx"
ON "RecurringReportRun"("workspaceId", "createdAt");

CREATE INDEX "RecurringReportRun_projectId_createdAt_idx"
ON "RecurringReportRun"("projectId", "createdAt");

CREATE INDEX "RecurringReportRun_workspaceId_scope_createdAt_idx"
ON "RecurringReportRun"("workspaceId", "scope", "createdAt");

ALTER TABLE "RecurringReportRun"
ADD CONSTRAINT "RecurringReportRun_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringReportRun"
ADD CONSTRAINT "RecurringReportRun_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
