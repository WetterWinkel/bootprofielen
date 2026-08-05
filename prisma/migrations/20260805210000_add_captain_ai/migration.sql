-- CreateEnum
CREATE TYPE "CaptainMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "CaptainConversation" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'ACCOUNT',
    "boatContext" JSONB NOT NULL DEFAULT '{}',
    "title" TEXT NOT NULL,
    "improvementConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptainConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptainMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "CaptainMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "products" JSONB NOT NULL DEFAULT '[]',
    "feedback" INTEGER,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptainMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaptainConversation_shop_customerId_profileId_updatedAt_idx" ON "CaptainConversation"("shop", "customerId", "profileId", "updatedAt");
CREATE INDEX "CaptainConversation_shop_updatedAt_idx" ON "CaptainConversation"("shop", "updatedAt");
CREATE INDEX "CaptainMessage_conversationId_createdAt_idx" ON "CaptainMessage"("conversationId", "createdAt");
CREATE INDEX "CaptainMessage_feedback_idx" ON "CaptainMessage"("feedback");

-- AddForeignKey
ALTER TABLE "CaptainMessage" ADD CONSTRAINT "CaptainMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CaptainConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
