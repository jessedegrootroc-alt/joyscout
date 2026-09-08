-- Google API budget guard: monthly usage counters + settings
ALTER TABLE "UserSettings" ADD COLUMN "googleMonthlyBudget" INTEGER NOT NULL DEFAULT 900,
                           ADD COLUMN "googleBudgetFallback" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Scan" ADD COLUMN "providerNote" TEXT;
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiUsage_provider_month_key" ON "ApiUsage"("provider", "month");
