-- AlterTable
ALTER TABLE "WorkspaceComment" ADD COLUMN "projectInsightId" TEXT;

-- CreateIndex
CREATE INDEX "WorkspaceComment_projectInsightId_createdAt_idx" ON "WorkspaceComment"("projectInsightId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceComment" ADD CONSTRAINT "WorkspaceComment_projectInsightId_fkey" FOREIGN KEY ("projectInsightId") REFERENCES "ProjectInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
