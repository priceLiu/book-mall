import { z } from "zod";

export const ECOM_STORYBOARD_TOOL_KEY = "ecom-toolkit__storyboard";
export const ECOM_STORYBOARD_MODULE = "storyboard-micro-drama";

export type StoryboardAssistantMode = "chat" | "sheet";

export type StoryboardChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type StoryboardReference = {
  id: string;
  label: string;
  role: "character" | "product" | "scene" | "other";
  ossUrl: string;
};

export const storyboardSheetSchema = z.object({
  overview: z.object({
    title: z.string().min(1),
    logline: z.string().min(1),
    productHighlight: z.string().optional(),
  }),
  cast: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        refId: z.string().optional(),
        /** 外貌/穿搭/年龄等视觉设定，供分镜图人物一致 */
        appearance: z.string().optional(),
      }),
    )
    .default([]),
  panels: z
    .array(
      z.object({
        index: z.number().int().positive(),
        timeline: z.string().optional(),
        shotType: z.string().min(1),
        scene: z.string().min(1),
        action: z.string().min(1),
        dialogue: z.string().optional(),
        camera: z.string().optional(),
        emotion: z.string().optional(),
        durationHintSec: z.number().positive().optional(),
        videoPromptEn: z.string().optional(),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
      }),
    )
    .min(1),
  totalDurationHintSec: z.number().positive().optional(),
});

export type StoryboardSheet = z.infer<typeof storyboardSheetSchema>;

/** 合并解析错误时同一镜号重复出现（如三套方案被合成一条），保留每个镜号首次出现 */
export function dedupeStoryboardPanelsByIndex<
  T extends { index: number },
>(panels: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const p of panels) {
    if (seen.has(p.index)) continue;
    seen.add(p.index);
    out.push(p);
  }
  return out.sort((a, b) => a.index - b.index);
}

export function storyboardPanelsHaveDuplicateIndex(
  panels: { index: number }[],
): boolean {
  const seen = new Set<number>();
  for (const p of panels) {
    if (seen.has(p.index)) return true;
    seen.add(p.index);
  }
  return false;
}

/** 补齐必填字段，避免编辑时清空触发 Zod 校验失败 */
export function normalizeStoryboardSheet(raw: StoryboardSheet): StoryboardSheet {
  return {
    ...raw,
    overview: {
      ...raw.overview,
      title: raw.overview.title?.trim() || "微剧情分镜",
      logline: raw.overview.logline?.trim() || "—",
      productHighlight: raw.overview.productHighlight?.trim() || undefined,
    },
    cast: raw.cast ?? [],
    panels: dedupeStoryboardPanelsByIndex(raw.panels).map((p) => {
      const scene = p.scene?.trim() || "—";
      const action = p.action?.trim() || scene;
      return {
        ...p,
        shotType: p.shotType?.trim() || "中景",
        scene,
        action,
      };
    }),
  };
}

export function parseStoryboardSheet(input: StoryboardSheet): StoryboardSheet {
  return storyboardSheetSchema.parse(normalizeStoryboardSheet(input));
}

export function parseStoryboardAssistantMode(raw: unknown): StoryboardAssistantMode {
  return raw === "sheet" ? "sheet" : "chat";
}

export function sanitizeStoryboardChatMessages(raw: unknown): StoryboardChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryboardChatMessage[] = [];
  for (const item of raw.slice(-80)) {
    if (!item || typeof item !== "object") continue;
    const { id, role, content, createdAt } = item as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const text = content.trim();
    if (!text || text.length > 24000) continue;
    out.push({
      id: typeof id === "string" ? id : `${role}-${out.length}`,
      role,
      content: text,
      createdAt:
        typeof createdAt === "string" ? createdAt : new Date().toISOString(),
    });
  }
  return out;
}

export function sanitizeClientChatTurns(
  raw: unknown,
): { role: "user" | "assistant"; content: string }[] {
  return sanitizeStoryboardChatMessages(raw).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export function sanitizeStoryboardReferences(raw: unknown): StoryboardReference[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryboardReference[] = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const ossUrl = typeof row.ossUrl === "string" ? row.ossUrl.trim() : "";
    if (!/^https?:\/\//.test(ossUrl)) continue;
    const roleRaw = typeof row.role === "string" ? row.role : "other";
    const role =
      roleRaw === "character" || roleRaw === "product" || roleRaw === "scene"
        ? roleRaw
        : "other";
    out.push({
      id: typeof row.id === "string" ? row.id : `ref-${out.length}`,
      label: typeof row.label === "string" ? row.label.slice(0, 40) : "参考图",
      role,
      ossUrl,
    });
  }
  return out;
}

export function extractStoryboardSheetJson(text: string): StoryboardSheet | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1));
      const result = storyboardSheetSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      /* try next */
    }
  }
  return null;
}
