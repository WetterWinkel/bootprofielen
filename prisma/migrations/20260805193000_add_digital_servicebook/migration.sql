-- CreateEnum
CREATE TYPE "ServiceBookStatus" AS ENUM ('COMPLETED', 'PLANNED');

-- CreateTable
CREATE TABLE "ServiceBookEntry" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "ServiceBookStatus" NOT NULL DEFAULT 'COMPLETED',
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "component" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "engineHours" INTEGER,
    "performedBy" TEXT,
    "partsMaterials" TEXT,
    "reference" TEXT,
    "costCents" INTEGER,
    "nextServiceHours" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceBookEntry_shop_customerId_profileId_serviceDate_idx" ON "ServiceBookEntry"("shop", "customerId", "profileId", "serviceDate");
CREATE INDEX "ServiceBookEntry_shop_profileId_idx" ON "ServiceBookEntry"("shop", "profileId");
CREATE INDEX "ServiceBookEntry_nextServiceDate_idx" ON "ServiceBookEntry"("nextServiceDate");
