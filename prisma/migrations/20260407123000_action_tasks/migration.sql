-- CreateTable
CREATE TABLE "ActionTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transcriptionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignee" TEXT,
    "dueDate" TIMESTAMP(3),
    "sourceActionIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ActionTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTask_userId_createdAt_idx" ON "ActionTask"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionTask_transcriptionId_createdAt_idx" ON "ActionTask"("transcriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionTask_transcriptionId_status_createdAt_idx" ON "ActionTask"("transcriptionId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ActionTask" ADD CONSTRAINT "ActionTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTask" ADD CONSTRAINT "ActionTask_transcriptionId_fkey" FOREIGN KEY ("transcriptionId") REFERENCES "Transcription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
