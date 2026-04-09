-- CreateTable
CREATE TABLE "WorkspaceNotification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceNotification_workspaceId_createdAt_idx" ON "WorkspaceNotification"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceNotification_userId_createdAt_idx" ON "WorkspaceNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceNotification_userId_readAt_createdAt_idx" ON "WorkspaceNotification"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceNotification" ADD CONSTRAINT "WorkspaceNotification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceNotification" ADD CONSTRAINT "WorkspaceNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
