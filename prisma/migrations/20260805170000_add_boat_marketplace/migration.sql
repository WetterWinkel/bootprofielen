-- CreateEnum
CREATE TYPE "BoatListingStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SOLD', 'EXPIRED');

-- CreateTable
CREATE TABLE "BoatListing" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "BoatListingStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "sellerType" TEXT NOT NULL,
    "vatStatus" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "publicData" JSONB NOT NULL,
    "photos" JSONB NOT NULL,
    "coverPhotoUrl" TEXT,
    "paymentToken" TEXT,
    "draftOrderId" TEXT,
    "paidOrderId" TEXT,
    "paidAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoatListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoatListingInquiry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoatListingInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoatListingReport" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BoatListingReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoatListing_slug_key" ON "BoatListing"("slug");
CREATE UNIQUE INDEX "BoatListing_paymentToken_key" ON "BoatListing"("paymentToken");
CREATE UNIQUE INDEX "BoatListing_draftOrderId_key" ON "BoatListing"("draftOrderId");
CREATE UNIQUE INDEX "BoatListing_paidOrderId_key" ON "BoatListing"("paidOrderId");
CREATE INDEX "BoatListing_shop_customerId_updatedAt_idx" ON "BoatListing"("shop", "customerId", "updatedAt");
CREATE INDEX "BoatListing_shop_status_publishedAt_idx" ON "BoatListing"("shop", "status", "publishedAt");
CREATE INDEX "BoatListing_profileId_idx" ON "BoatListing"("profileId");
CREATE INDEX "BoatListing_expiresAt_idx" ON "BoatListing"("expiresAt");
CREATE INDEX "BoatListingInquiry_listingId_createdAt_idx" ON "BoatListingInquiry"("listingId", "createdAt");
CREATE INDEX "BoatListingReport_listingId_createdAt_idx" ON "BoatListingReport"("listingId", "createdAt");
CREATE INDEX "BoatListingReport_resolvedAt_idx" ON "BoatListingReport"("resolvedAt");

-- AddForeignKey
ALTER TABLE "BoatListingInquiry" ADD CONSTRAINT "BoatListingInquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "BoatListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoatListingReport" ADD CONSTRAINT "BoatListingReport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "BoatListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
