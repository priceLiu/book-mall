-- CreateTable
CREATE TABLE "SsoAuthorizationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoAuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SsoAuthorizationCode_code_key" ON "SsoAuthorizationCode"("code");

-- CreateIndex
CREATE INDEX "SsoAuthorizationCode_expiresAt_idx" ON "SsoAuthorizationCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "SsoAuthorizationCode" ADD CONSTRAINT "SsoAuthorizationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
