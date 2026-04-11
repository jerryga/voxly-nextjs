-- AlterTable
ALTER TABLE "WorkspaceComment" ADD COLUMN "workspaceInsightId" TEXT;

-- CreateIndex
CREATE INDEX "WorkspaceComment_workspaceInsightId_createdAt_idx" ON "WorkspaceComment"("workspaceInsightId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceComment" ADD CONSTRAINT "WorkspaceComment_workspaceInsightId_fkey" FOREIGN KEY ("workspaceInsightId") REFERENCES "WorkspaceInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
