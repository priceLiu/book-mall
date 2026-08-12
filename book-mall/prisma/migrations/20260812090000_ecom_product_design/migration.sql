-- e-commerce-toolkit: 电商产品创作（主图 + 详情页 9 步流水线）项目表

CREATE TABLE "EcomProductDesignProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'product-creation',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "platform" TEXT,
    "brief" JSONB,
    "settings" JSONB,
    "references" JSONB,
    "chatHistory" JSONB,
    "design" JSONB,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomProductDesignProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EcomProductDesignProject_userId_module_updatedAt_idx" ON "EcomProductDesignProject"("userId", "module", "updatedAt");

CREATE INDEX "EcomProductDesignProject_tenantId_visibility_updatedAt_idx" ON "EcomProductDesignProject"("tenantId", "visibility", "updatedAt");

ALTER TABLE "EcomProductDesignProject" ADD CONSTRAINT "EcomProductDesignProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
