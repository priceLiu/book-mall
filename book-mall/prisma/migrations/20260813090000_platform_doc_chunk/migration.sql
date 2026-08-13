-- 平台 AI 导览助手：白名单文档切块（pgvector RAG 知识库）

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "PlatformDocChunk" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformDocChunk_pkey" PRIMARY KEY ("id")
);

-- embedding 列：Prisma 不支持 vector 类型，故以原生 SQL 添加（维度对应 text-embedding-v3 的 1024）
ALTER TABLE "PlatformDocChunk" ADD COLUMN IF NOT EXISTS "embedding" vector(1024);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformDocChunk_source_heading_contentHash_key"
    ON "PlatformDocChunk"("source", "heading", "contentHash");

CREATE INDEX IF NOT EXISTS "PlatformDocChunk_category_idx"
    ON "PlatformDocChunk"("category");

CREATE INDEX IF NOT EXISTS "PlatformDocChunk_embedding_idx"
    ON "PlatformDocChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
