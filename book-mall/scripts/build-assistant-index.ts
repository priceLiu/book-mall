/**
 * 平台 AI 导览助手 · 知识入库脚本。
 * 读取白名单文档 → 按标题切块 → 平台代付 embedding → 写入 pgvector 表 PlatformDocChunk。
 *
 * 用法：pnpm assistant:index [--dry-run]
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  KNOWLEDGE_ALLOWLIST,
  type KnowledgeSource,
} from "@/lib/platform-assistant/knowledge-allowlist";
import { platformEmbedTextsInProcess } from "@/lib/platform-assistant/platform-gateway";
import { toVectorLiteral } from "@/lib/platform-assistant/retriever";
import { getAssistantEmbedRuntimeConfig } from "@/lib/platform-assistant/platform-assistant-model-config-service";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const DRY_RUN = process.argv.includes("--dry-run");

/** 粗略 token 估计（中文按字符，英文按 ~4 char/token）。 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

type Chunk = { heading: string; content: string };

/** 入库前脱敏：不把内部工程代号 libtv 暴露给导览助手。 */
function sanitizeChunkContent(text: string): string {
  return text
    .replace(/\blibtv\b/gi, "影视专业版节点")
    .replace(/LibTV/g, "影视专业版");
}

/** 按 Markdown 标题层级切块，过大的块再按段落二次切分。 */
function chunkMarkdown(md: string): Chunk[] {
  const lines = md.split(/\r?\n/);
  const sections: { heading: string; body: string[] }[] = [];
  const headingStack: string[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      if (current) sections.push(current);
      const level = m[1].length;
      const title = m[2].trim();
      headingStack.length = Math.max(0, level - 1);
      headingStack[level - 1] = title;
      const headingPath = headingStack.filter(Boolean).join(" > ");
      current = { heading: headingPath || title, body: [] };
    } else {
      if (!current) current = { heading: "", body: [] };
      current.body.push(line);
    }
  }
  if (current) sections.push(current);

  const MAX_CHARS = 1400;
  const chunks: Chunk[] = [];
  for (const s of sections) {
    const body = s.body.join("\n").trim();
    if (!body) continue;
    if (body.length <= MAX_CHARS) {
      chunks.push({ heading: s.heading, content: sanitizeChunkContent(body) });
      continue;
    }
    // 二次切分：按空行段落聚合到 MAX_CHARS
    const paras = body.split(/\n{2,}/);
    let buf = "";
    for (const p of paras) {
      if ((buf + "\n\n" + p).length > MAX_CHARS && buf) {
        chunks.push({ heading: s.heading, content: sanitizeChunkContent(buf.trim()) });
        buf = p;
      } else {
        buf = buf ? `${buf}\n\n${p}` : p;
      }
    }
    if (buf.trim()) chunks.push({ heading: s.heading, content: sanitizeChunkContent(buf.trim()) });
  }
  return chunks.filter((c) => c.content.replace(/\s/g, "").length >= 8);
}

function hashContent(source: string, heading: string, content: string): string {
  return createHash("sha256").update(`${source}\u0000${heading}\u0000${content}`).digest("hex").slice(0, 32);
}

async function loadSource(src: KnowledgeSource): Promise<Chunk[]> {
  const abs = path.join(REPO_ROOT, src.path);
  try {
    const md = await readFile(abs, "utf8");
    return chunkMarkdown(md);
  } catch (e) {
    console.warn(`[assistant:index] 跳过（读取失败）: ${src.path} — ${(e as Error).message}`);
    return [];
  }
}

async function main() {
  const embedConfig = await getAssistantEmbedRuntimeConfig();
  if (!embedConfig.enabled) {
    console.error("[assistant:index] 向量检索已在管理后台关闭，无法入库。");
    process.exit(1);
  }

  console.log(
    `[assistant:index] embed model=${embedConfig.modelKey} dim=${embedConfig.embedDim} dryRun=${DRY_RUN}`,
  );

  type Pending = {
    source: string;
    category: string;
    heading: string;
    content: string;
    contentHash: string;
  };
  const pending: Pending[] = [];

  for (const src of KNOWLEDGE_ALLOWLIST) {
    const chunks = await loadSource(src);
    for (const c of chunks) {
      pending.push({
        source: src.path,
        category: src.category,
        heading: c.heading,
        content: c.content,
        contentHash: hashContent(src.path, c.heading, c.content),
      });
    }
    console.log(`[assistant:index] ${src.path} → ${chunks.length} chunks`);
  }

  console.log(`[assistant:index] 合计 ${pending.length} chunks`);
  if (DRY_RUN) {
    console.log("[assistant:index] dry-run，未写库。");
    return;
  }
  if (pending.length === 0) return;

  // 逐批 embedding（DashScope text-embedding-v3 单次最多 10 条），带重试防瞬时 TLS 断连
  const BATCH = 10;
  const embeddings: number[][] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    let vecs: number[][] | null = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        vecs = await platformEmbedTextsInProcess(
          batch.map((p) => p.content),
          {
            model: embedConfig.modelKey,
            dimensions: embedConfig.embedDim,
          },
        );
        break;
      } catch (e) {
        if (attempt === 4) throw e;
        const wait = 1000 * attempt;
        console.warn(
          `[assistant:index] batch@${i} 第 ${attempt} 次失败，${wait}ms 后重试：${(e as Error).message}`,
        );
        await sleep(wait);
      }
    }
    embeddings.push(...(vecs ?? []));
    console.log(`[assistant:index] embedded ${Math.min(i + BATCH, pending.length)}/${pending.length}`);
  }

  // 全量重建白名单来源的行（先删这些 source，再插入）
  const sources = Array.from(new Set(pending.map((p) => p.source)));
  await prisma.$executeRaw(
    Prisma.sql`DELETE FROM "PlatformDocChunk" WHERE "source" = ANY(${sources})`,
  );

  let ok = 0;
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    const vec = embeddings[i];
    if (!vec || vec.length === 0) {
      console.warn(`[assistant:index] 无 embedding，跳过: ${p.source} / ${p.heading}`);
      continue;
    }
    const id = `pdc_${p.contentHash}`;
    const literal = toVectorLiteral(vec);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "PlatformDocChunk"
        ("id", "source", "category", "heading", "content", "tokens", "contentHash", "embedding", "createdAt", "updatedAt")
      VALUES
        (${id}, ${p.source}, ${p.category}, ${p.heading}, ${p.content}, ${estimateTokens(p.content)}, ${p.contentHash}, ${literal}::vector, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "category" = EXCLUDED."category",
        "content" = EXCLUDED."content",
        "tokens" = EXCLUDED."tokens",
        "embedding" = EXCLUDED."embedding",
        "updatedAt" = NOW()
    `);
    ok++;
  }
  console.log(`[assistant:index] 写入完成，${ok} 行。`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[assistant:index] 失败:", e);
    process.exit(1);
  });
