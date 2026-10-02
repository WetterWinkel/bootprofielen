-- Captain AI: maandpas + eenmalig vragenpakket
ALTER TYPE "CaptainUsageType" ADD VALUE IF NOT EXISTS 'PASS';
ALTER TABLE "CaptainCreditBalance" ADD COLUMN "passUntil" TIMESTAMP(3);
ALTER TABLE "CaptainCreditPurchase" ADD COLUMN "passDays" INTEGER NOT NULL DEFAULT 0;
