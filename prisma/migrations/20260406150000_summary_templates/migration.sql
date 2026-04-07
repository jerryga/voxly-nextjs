-- CreateTable
CREATE TABLE "SummaryTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseTemplate" TEXT NOT NULL DEFAULT 'default',
    "promptInstructions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummaryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SummaryTemplate_userId_createdAt_idx" ON "SummaryTemplate"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SummaryTemplate_userId_slug_key" ON "SummaryTemplate"("userId", "slug");

-- AddForeignKey
ALTER TABLE "SummaryTemplate" ADD CONSTRAINT "SummaryTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
