-- CreateTable
CREATE TABLE "WorkspaceInsight" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidenceNote" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "projectIds" JSONB,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceInsight_workspaceId_createdAt_idx" ON "WorkspaceInsight"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceInsight_createdById_createdAt_idx" ON "WorkspaceInsight"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceInsight" ADD CONSTRAINT "WorkspaceInsight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInsight" ADD CONSTRAINT "WorkspaceInsight_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
