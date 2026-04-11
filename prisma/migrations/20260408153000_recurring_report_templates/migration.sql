CREATE TABLE "RecurringReportTemplate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "targetScope" TEXT NOT NULL,
  "cadence" TEXT NOT NULL DEFAULT 'weekly',
  "reportType" TEXT NOT NULL DEFAULT 'summary',
  "weekday" INTEGER NOT NULL DEFAULT 1,
  "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
  "hourLocal" INTEGER NOT NULL DEFAULT 9,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "recipientScope" TEXT NOT NULL DEFAULT 'managers',
  "sendEmail" BOOLEAN NOT NULL DEFAULT true,
  "sendSlack" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecurringReportTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringReportTemplate_workspaceId_targetScope_createdAt_idx"
ON "RecurringReportTemplate"("workspaceId", "targetScope", "createdAt");

CREATE INDEX "RecurringReportTemplate_createdById_createdAt_idx"
ON "RecurringReportTemplate"("createdById", "createdAt");

ALTER TABLE "RecurringReportTemplate"
ADD CONSTRAINT "RecurringReportTemplate_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringReportTemplate"
ADD CONSTRAINT "RecurringReportTemplate_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
