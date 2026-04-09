-- CreateTable
CREATE TABLE "ProjectDigestSettings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cadence" TEXT NOT NULL DEFAULT 'weekly',
    "weekday" INTEGER NOT NULL DEFAULT 1,
    "hourLocal" INTEGER NOT NULL DEFAULT 9,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "recipientScope" TEXT NOT NULL DEFAULT 'managers',
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDigestSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDigestSettings_projectId_key" ON "ProjectDigestSettings"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDigestSettings_enabled_cadence_weekday_hourLocal_idx" ON "ProjectDigestSettings"("enabled", "cadence", "weekday", "hourLocal");

-- AddForeignKey
ALTER TABLE "ProjectDigestSettings" ADD CONSTRAINT "ProjectDigestSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
