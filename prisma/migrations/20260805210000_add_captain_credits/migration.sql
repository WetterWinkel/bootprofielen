-- CreateEnum
CREATE TYPE "CaptainUsageType" AS ENUM ('FREE', 'CREDIT');

-- AlterTable
ALTER TABLE "CaptainMessage" ADD COLUMN "usageType" "CaptainUsageType";

-- CreateTable
CREATE TABLE "CaptainCreditBalance" (
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptainCreditBalance_pkey" PRIMARY KEY ("shop","customerId")
);

-- CreateTable
CREATE TABLE "CaptainCreditPurchase" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "paymentToken" TEXT NOT NULL,
    "draftOrderId" TEXT,
    "paidOrderId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptainCreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaptainCreditPurchase_paymentToken_key" ON "CaptainCreditPurchase"("paymentToken");

-- CreateIndex
CREATE UNIQUE INDEX "CaptainCreditPurchase_draftOrderId_key" ON "CaptainCreditPurchase"("draftOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptainCreditPurchase_paidOrderId_key" ON "CaptainCreditPurchase"("paidOrderId");

-- CreateIndex
CREATE INDEX "CaptainCreditPurchase_shop_customerId_createdAt_idx" ON "CaptainCreditPurchase"("shop", "customerId", "createdAt");
