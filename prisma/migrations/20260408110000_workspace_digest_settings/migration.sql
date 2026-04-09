-- CreateTable
CREATE TABLE "WorkspaceDigestSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cadence" TEXT NOT NULL DEFAULT 'weekly',
    "weekday" INTEGER NOT NULL DEFAULT 1,
    "hourLocal" INTEGER NOT NULL DEFAULT 9,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "recipientScope" TEXT NOT NULL DEFAULT 'managers',
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceDigestSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceDigestSettings_workspaceId_key" ON "WorkspaceDigestSettings"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceDigestSettings_enabled_cadence_weekday_hourLocal_idx" ON "WorkspaceDigestSettings"("enabled", "cadence", "weekday", "hourLocal");

-- AddForeignKey
ALTER TABLE "WorkspaceDigestSettings" ADD CONSTRAINT "WorkspaceDigestSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
