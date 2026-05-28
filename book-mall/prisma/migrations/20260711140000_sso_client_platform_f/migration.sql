-- Phase F：第三方 SSO 客户端 + 授权码 clientId

CREATE TABLE "SsoClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "allowedNavKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SsoClient_clientId_key" ON "SsoClient"("clientId");

ALTER TABLE "SsoAuthorizationCode" ADD COLUMN "clientId" TEXT;

CREATE INDEX "SsoAuthorizationCode_clientId_idx" ON "SsoAuthorizationCode"("clientId");
