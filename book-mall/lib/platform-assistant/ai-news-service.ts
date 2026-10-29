/**
 * AI 小智 · 每日 AI 热闻（Cron 预生成 + DB 持久化，全平台只读）。
 * 生成经 Gateway 百炼 LLM（默认 qwen3.5-27b，失败时走对话兜底链）。
 */
import type { PlatformAssistantAiNewsStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  ASSISTANT_NEWS_MAX_TOKENS,
} from "@/lib/platform-assistant/config";
import { getAssistantNewsRuntimeConfig } from "@/lib/platform-assistant/platform-assistant-model-config-service";
import {
  platformChatCompletion,
  PlatformAssistantGatewayError,
} from "@/lib/platform-assistant/platform-gateway";

const CST_OFFSET_MS = 8 * 60 * 60 * 1000;
const RETAIN_DAYS = 3;
const READ_CACHE_MS = 30_000;

export function cstDateLabel(now = new Date()): string {
  const cst = new Date(now.getTime() + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}年${cst.getUTCMonth() + 1}月${cst.getUTCDate()}日`;
}

export function cstDateKey(now = new Date()): string {
  const cst = new Date(now.getTime() + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${String(cst.getUTCMonth() + 1).padStart(2, "0")}-${String(cst.getUTCDate()).padStart(2, "0")}`;
}

export function previousCstDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000;
  const cst = new Date(utc + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${String(cst.getUTCMonth() + 1).padStart(2, "0")}-${String(cst.getUTCDate()).padStart(2, "0")}`;
}

export function pruneCutoffDateKey(now = new Date()): string {
  const cst = new Date(now.getTime() + CST_OFFSET_MS - RETAIN_DAYS * 24 * 60 * 60 * 1000);
  return `${cst.getUTCFullYear()}-${String(cst.getUTCMonth() + 1).padStart(2, "0")}-${String(cst.getUTCDate()).padStart(2, "0")}`;
}

/** 热闻整理提示词（Gateway 百炼 LLM，无第三方搜索 Key）。 */
export function buildAiNewsPrompt(now = new Date()): string {
  const date = cstDateLabel(now);

  return `请整理一份「${date}」人工智能 / AI 领域的热点资讯简报，共 10 条。

要求如下：

1. **内容方向**：聚焦近期（以 ${date} 为锚点）行业热议话题。条目归入最贴切的一类，不要重复。

2. **分类维度**（标题独占一行）：
   - 【模型发布】放在最前。仅当这几天确有新模型、大版本或正式上线时才写，1～3 条，计入 10 条。标题用「发布方 模型名」，写清主要能力变化。没有把握就整段省略，禁止编造模型名和发布日期。
   - 【资本与行业动态】（融资、IPO、大厂合作、算力基建）
   - 【AI内容与应用】（AI 短剧、AI 音乐、AI 绘画、爆款案例）
   - 【政策/会议/国际动态】（政府政策、国际会议、海外合作）
   - 【技术前沿与争议】（论文、开源、学术争议、伦理话题；已写入模型发布的不要再写一遍）
   除【模型发布】外，其余四个板块都要出现。某一类没有足够把握时，用你有把握的条目补足，不要为了凑数编造。

3. **每条内容需包含**（Markdown 格式）：
   - 全局连续编号
   - **标题**（一句话概括，加粗）
   - 核心事实：（50字以内）
   - 出处：（媒体/官网/机构名；尽量具体，勿编造不存在的 URL）
   - 发表时间：（YYYY年M月D日；若只能估到「近日」须说明，且不得晚于 ${date}）

4. **真实性**：只写你较有把握、符合近期行业语境的内容；不确定的条目宁可少写，**禁止编造具体数字、虚假公司名、虚假模型名或虚构事件**。${date} 就是今天，按这一天写近期新闻。禁止输出「重要提示」「模拟推演」「非真实新闻」「请勿作为投资依据」或任何免责声明长文。【模型发布】只写具体发布方和模型名；架构趋势、榜单变化、芯片或融资不要放进这一板块。

5. **输出规范**：
   - 不要 JSON、不要代码块
   - 第一行固定为：📰 ${date} AI 热闻
   - 分类标题单独一行，格式为【分类名】
   - 每条末尾必须含「出处」「发表时间」两行
   - 全文末尾单独一行：*以上内容由 AI 整理，时效性与事实请以权威来源为准。*

请按以上要求生成最终结果，语言简洁，适合直接阅读。`;
}

/** Cron / CLI / 管理后台：Gateway 百炼 LLM 生成当日 Markdown。 */
export async function generateAiNewsBriefNow(now = new Date()): Promise<string> {
  const newsConfig = await getAssistantNewsRuntimeConfig();
  if (!newsConfig.enabled) {
    throw new PlatformAssistantGatewayError("AI 热闻已在管理后台关闭", 503);
  }

  const userPrompt = buildAiNewsPrompt(now);

  const content = await platformChatCompletion({
    model: newsConfig.modelKey,
    fallbackModels: newsConfig.fallbackModelKeys,
    messages: [
      {
        role: "system",
        content:
          "你是 AI 小智的资讯编辑。你通过 Gateway 调用大模型能力整理 AI 行业热点简报。不得捏造明显虚假新闻。确有新模型或大版本发布时，必须写入【模型发布】并放在最前；没有把握就不要写该板块。输出中文 Markdown，严格遵守版式。",
      },
      { role: "user", content: userPrompt },
    ],
    maxTokens: ASSISTANT_NEWS_MAX_TOKENS,
    temperature: 0.35,
    clientPage: "platform-assistant/ai-news-generate",
  });
  if (!content) {
    throw new PlatformAssistantGatewayError("热闻生成结果为空", 502);
  }
  return content;
}

export async function persistDailyAiNews(opts: {
  dateKey: string;
  content: string;
  status?: PlatformAssistantAiNewsStatus;
  errorMessage?: string | null;
}) {
  return prisma.platformAssistantAiNewsDaily.upsert({
    where: { dateKey: opts.dateKey },
    create: {
      dateKey: opts.dateKey,
      content: opts.content,
      status: opts.status ?? "READY",
      errorMessage: opts.errorMessage ?? null,
      generatedAt: new Date(),
    },
    update: {
      content: opts.content,
      status: opts.status ?? "READY",
      errorMessage: opts.errorMessage ?? null,
      generatedAt: new Date(),
    },
  });
}

export async function recordDailyAiNewsFailure(dateKey: string, errorMessage: string) {
  return prisma.platformAssistantAiNewsDaily.upsert({
    where: { dateKey },
    create: {
      dateKey,
      content: "",
      status: "FAILED",
      errorMessage: errorMessage.slice(0, 2000),
      generatedAt: new Date(),
    },
    update: {
      status: "FAILED",
      errorMessage: errorMessage.slice(0, 2000),
      generatedAt: new Date(),
    },
  });
}

/** 删除早于保留窗口的 dateKey。 */
export async function pruneAiNewsOlderThanRetainWindow(now = new Date()) {
  const cutoff = pruneCutoffDateKey(now);
  const result = await prisma.platformAssistantAiNewsDaily.deleteMany({
    where: { dateKey: { lt: cutoff } },
  });
  return { cutoff, deleted: result.count };
}

/** Cron 入口：生成 + 入库 + 清理。 */
export async function runDailyAiNewsGeneration(now = new Date()) {
  const dateKey = cstDateKey(now);
  try {
    const content = await generateAiNewsBriefNow(now);
    const row = await persistDailyAiNews({ dateKey, content, status: "READY" });
    const pruned = await pruneAiNewsOlderThanRetainWindow(now);
    return { ok: true as const, dateKey, row, pruned };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordDailyAiNewsFailure(dateKey, msg);
    throw e;
  }
}

export type AiNewsDailyRow = {
  dateKey: string;
  content: string;
  status: PlatformAssistantAiNewsStatus;
  generatedAt: Date;
  errorMessage: string | null;
};

export async function readDailyAiNews(
  dateKey: string,
): Promise<AiNewsDailyRow | null> {
  const row = await prisma.platformAssistantAiNewsDaily.findUnique({
    where: { dateKey },
  });
  if (!row || row.status !== "READY" || !row.content.trim()) return null;
  return row;
}

export async function listRecentAiNewsDaily(limit = 3) {
  return prisma.platformAssistantAiNewsDaily.findMany({
    orderBy: { dateKey: "desc" },
    take: limit,
    select: {
      dateKey: true,
      status: true,
      generatedAt: true,
      errorMessage: true,
      content: true,
    },
  });
}

type ClientReadCache = {
  at: number;
  payload: Awaited<ReturnType<typeof getLatestAiNewsForClient>>;
};

let readCache: ClientReadCache | null = null;

/** 客户端 GET：今日 READY → 昨日 READY → 库内最近一条 READY（stale）。 */
export async function getLatestAiNewsForClient(now = new Date()): Promise<{
  content: string;
  dateKey: string;
  stale: boolean;
  generatedAt: string;
}> {
  const todayKey = cstDateKey(now);
  const today = await readDailyAiNews(todayKey);
  if (today) {
    return {
      content: today.content,
      dateKey: today.dateKey,
      stale: false,
      generatedAt: today.generatedAt.toISOString(),
    };
  }

  const yesterdayKey = previousCstDateKey(todayKey);
  const yesterday = await readDailyAiNews(yesterdayKey);
  if (yesterday) {
    return {
      content: yesterday.content,
      dateKey: yesterday.dateKey,
      stale: true,
      generatedAt: yesterday.generatedAt.toISOString(),
    };
  }

  const latest = await prisma.platformAssistantAiNewsDaily.findFirst({
    where: { status: "READY", NOT: { content: "" } },
    orderBy: { dateKey: "desc" },
  });
  if (latest?.content.trim()) {
    return {
      content: latest.content.trim(),
      dateKey: latest.dateKey,
      stale: true,
      generatedAt: latest.generatedAt.toISOString(),
    };
  }

  /** 无预生成热闻：返回空内容（200），避免全站 layout 预取在控制台刷 503 */
  return {
    content: "",
    dateKey: todayKey,
    stale: true,
    generatedAt: now.toISOString(),
  };
}

export async function getPlatformAiNewsBrief(opts?: {
  now?: Date;
}): Promise<{
  content: string;
  dateKey: string;
  stale: boolean;
  generatedAt: string;
  cached: boolean;
}> {
  const now = opts?.now ?? new Date();
  if (readCache && Date.now() - readCache.at < READ_CACHE_MS) {
    return { ...readCache.payload, cached: true };
  }
  const payload = await getLatestAiNewsForClient(now);
  readCache = { at: Date.now(), payload };
  return { ...payload, cached: false };
}

/** 测试用：清空读缓存 */
export function resetAiNewsCacheForTests() {
  readCache = null;
}
