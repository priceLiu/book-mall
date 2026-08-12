-- CreateEnum
CREATE TYPE "ClientDeviceType" AS ENUM ('WEB', 'EXTENSION', 'DESKTOP');

-- CreateTable
CREATE TABLE "ClientDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceType" "ClientDeviceType" NOT NULL,
    "deviceName" TEXT,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDeviceSessionVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceType" "ClientDeviceType" NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDeviceSessionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientDevice_refreshTokenHash_key" ON "ClientDevice"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "ClientDevice_userId_idx" ON "ClientDevice"("userId");

-- CreateIndex
CREATE INDEX "ClientDevice_userId_deviceType_idx" ON "ClientDevice"("userId", "deviceType");

-- CreateIndex
CREATE INDEX "ClientDevice_expiresAt_idx" ON "ClientDevice"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserDeviceSessionVersion_userId_deviceType_key" ON "UserDeviceSessionVersion"("userId", "deviceType");

-- CreateIndex
CREATE INDEX "UserDeviceSessionVersion_userId_idx" ON "UserDeviceSessionVersion"("userId");

-- AddForeignKey
ALTER TABLE "ClientDevice" ADD CONSTRAINT "ClientDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDeviceSessionVersion" ADD CONSTRAINT "UserDeviceSessionVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
