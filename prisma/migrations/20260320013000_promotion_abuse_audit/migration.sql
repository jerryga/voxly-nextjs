-- AlterTable
ALTER TABLE "PromotionRedemption"
ADD COLUMN "ipHash" TEXT,
ADD COLUMN "userAgentHash" TEXT;

-- CreateIndex
CREATE INDEX "PromotionRedemption_ipHash_createdAt_idx" ON "PromotionRedemption"("ipHash", "createdAt");
