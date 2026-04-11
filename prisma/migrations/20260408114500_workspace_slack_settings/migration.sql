-- CreateTable
CREATE TABLE "WorkspaceSlackSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sendDigests" BOOLEAN NOT NULL DEFAULT true,
    "webhookUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSlackSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSlackSettings_workspaceId_key" ON "WorkspaceSlackSettings"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceSlackSettings_enabled_sendDigests_idx" ON "WorkspaceSlackSettings"("enabled", "sendDigests");

-- AddForeignKey
ALTER TABLE "WorkspaceSlackSettings" ADD CONSTRAINT "WorkspaceSlackSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
