CREATE TABLE "BoatTransfer" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fromCustomerId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoatTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoatTransfer_codeHash_key" ON "BoatTransfer"("codeHash");
CREATE UNIQUE INDEX "BoatTransfer_shop_profileId_key" ON "BoatTransfer"("shop", "profileId");
CREATE INDEX "BoatTransfer_expiresAt_idx" ON "BoatTransfer"("expiresAt");
