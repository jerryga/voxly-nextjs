-- CreateTable
CREATE TABLE "WorkspaceNotionSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiToken" TEXT NOT NULL,
    "parentPageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "WorkspaceNotionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceNotionSettings_workspaceId_key" ON "WorkspaceNotionSettings"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceNotionSettings" ADD CONSTRAINT "WorkspaceNotionSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
