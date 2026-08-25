-- CreateTable
CREATE TABLE "CaptainStorefrontEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "pageUrl" TEXT,
    "pageType" TEXT,
    "productId" TEXT,
    "productTitle" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptainStorefrontEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaptainStorefrontEvent_shop_createdAt_idx" ON "CaptainStorefrontEvent"("shop", "createdAt");
CREATE INDEX "CaptainStorefrontEvent_shop_event_createdAt_idx" ON "CaptainStorefrontEvent"("shop", "event", "createdAt");
CREATE INDEX "CaptainStorefrontEvent_shop_visitorId_createdAt_idx" ON "CaptainStorefrontEvent"("shop", "visitorId", "createdAt");
