-- AlterTable
ALTER TABLE "User" ADD COLUMN "gatewayApiKeyId" TEXT;
ALTER TABLE "User" ADD COLUMN "gatewayApiKeyLinkedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_gatewayApiKeyId_key" ON "User"("gatewayApiKeyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gatewayApiKeyId_fkey" FOREIGN KEY ("gatewayApiKeyId") REFERENCES "GatewayApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
