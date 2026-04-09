-- CreateTable
CREATE TABLE "ProjectInsight" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidenceNote" TEXT,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectInsight_workspaceId_projectId_createdAt_idx" ON "ProjectInsight"("workspaceId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectInsight_projectId_createdAt_idx" ON "ProjectInsight"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectInsight_createdById_createdAt_idx" ON "ProjectInsight"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectInsight" ADD CONSTRAINT "ProjectInsight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInsight" ADD CONSTRAINT "ProjectInsight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInsight" ADD CONSTRAINT "ProjectInsight_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
