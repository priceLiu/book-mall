/**
 * 平台 AI 导览助手 · pgvector 检索。
 * embedding 列为原生 vector，Prisma Client 不识别，故走 $queryRaw + 余弦距离。
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { platformEmbedTexts } from "@/lib/platform-assistant/platform-gateway";
import {
  ASSISTANT_EMBED_DIM,
  ASSISTANT_EMBED_MODEL,
  ASSISTANT_TOP_K,
} from "@/lib/platform-assistant/config";

export type RetrievedChunk = {
  id: string;
  source: string;
  category: string;
  heading: string;
  content: string;
  distance: number;
};

/** 将 number[] 序列化为 pgvector 字面量 '[a,b,c]'。 */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => (Number.isFinite(n) ? n : 0)).join(",")}]`;
}

/** 查询 embedding 进程内 LRU 缓存（相同问题免二次向量化，降低延迟）。 */
const EMBED_CACHE = new Map<string, number[]>();
const EMBED_CACHE_MAX = 256;

async function embedQueryCached(q: string): Promise<number[]> {
  const cached = EMBED_CACHE.get(q);
  if (cached) {
    // 触达即刷新到队尾（LRU）
    EMBED_CACHE.delete(q);
    EMBED_CACHE.set(q, cached);
    return cached;
  }
  // DashScope 偶发瞬时 TLS 断连；重试一次以保证检索/知识落地（前端已显示「正在输入」）。
  let vec: number[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const [embedding] = await platformEmbedTexts([q], {
        model: ASSISTANT_EMBED_MODEL,
        dimensions: ASSISTANT_EMBED_DIM,
        clientPage: "platform-assistant/retrieve",
        timeoutMs: 20_000,
      });
      vec = embedding ?? [];
      break;
    } catch (e) {
      if (attempt === 2) throw e;
      console.warn(
        "[platform-assistant] embed retry:",
        (e as Error).message,
      );
    }
  }
  if (vec.length > 0) {
    EMBED_CACHE.set(q, vec);
    if (EMBED_CACHE.size > EMBED_CACHE_MAX) {
      const oldest = EMBED_CACHE.keys().next().value;
      if (oldest !== undefined) EMBED_CACHE.delete(oldest);
    }
  }
  return vec;
}

/** 对用户问题检索 top-k 知识块（余弦距离升序）。 */
export async function retrieveChunks(
  query: string,
  opts?: { topK?: number; categories?: string[] },
): Promise<RetrievedChunk[]> {
  const q = query.trim();
  if (!q) return [];

  const embedding = await embedQueryCached(q);
  if (!embedding || embedding.length === 0) return [];

  const topK = opts?.topK ?? ASSISTANT_TOP_K;
  const literal = toVectorLiteral(embedding);

  const categoryFilter =
    opts?.categories && opts.categories.length > 0
      ? Prisma.sql`AND "category" = ANY(${opts.categories})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<RetrievedChunk[]>(Prisma.sql`
    SELECT "id", "source", "category", "heading", "content",
           ("embedding" <=> ${literal}::vector) AS "distance"
    FROM "PlatformDocChunk"
    WHERE "embedding" IS NOT NULL
    ${categoryFilter}
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${topK}
  `);

  return rows.map((r) => ({
    ...r,
    distance: typeof r.distance === "number" ? r.distance : Number(r.distance),
  }));
}
