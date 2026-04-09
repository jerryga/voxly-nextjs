-- CreateTable
CREATE TABLE "WorkspaceComment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transcriptionId" TEXT,
    "actionTaskId" TEXT,
    "content" TEXT NOT NULL,
    "mentions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceComment_workspaceId_createdAt_idx" ON "WorkspaceComment"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceComment_transcriptionId_createdAt_idx" ON "WorkspaceComment"("transcriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceComment_actionTaskId_createdAt_idx" ON "WorkspaceComment"("actionTaskId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceComment_userId_createdAt_idx" ON "WorkspaceComment"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceComment" ADD CONSTRAINT "WorkspaceComment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceComment" ADD CONSTRAINT "WorkspaceComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceComment" ADD CONSTRAINT "WorkspaceComment_transcriptionId_fkey" FOREIGN KEY ("transcriptionId") REFERENCES "Transcription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceComment" ADD CONSTRAINT "WorkspaceComment_actionTaskId_fkey" FOREIGN KEY ("actionTaskId") REFERENCES "ActionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
