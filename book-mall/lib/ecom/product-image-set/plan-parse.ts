import type { ProductImageSetSlotKind } from "./types";

const KIND_ALIASES: Record<string, ProductImageSetSlotKind> = {
  white_bg: "white_bg",
  whitebg: "white_bg",
  "white-bg": "white_bg",
  white: "white_bg",
  sellpoint: "sellpoint",
  sell: "sellpoint",
  scene: "scene",
  model: "scene",
  other: "other",
  detail: "other",
};

/** 从模型回复中提取 JSON 对象（支持 markdown 围栏） */
export function extractJsonObjectFromLlmText(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fence?.[1] ?? trimmed).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("套图 Prompt 规划未返回有效 JSON");
  }
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

export function buildProductImageSetSlotIdAliasMap(
  expectedIds: Iterable<string>,
): Map<string, string> {
  const map = new Map<string, string>();
  const register = (alias: string, canonical: string) => {
    const key = alias.trim().toLowerCase();
    if (!key) return;
    map.set(key, canonical);
  };

  for (const canonical of expectedIds) {
    register(canonical, canonical);
    const dash = canonical.lastIndexOf("-");
    if (dash <= 0) continue;
    const kindPart = canonical.slice(0, dash);
    const num = canonical.slice(dash + 1);
    if (!/^\d+$/.test(num)) continue;

    register(`${kindPart}_${num}`, canonical);
    register(`${kindPart}${num}`, canonical);
    register(`${kindPart.replace(/_/g, "")}-${num}`, canonical);
    register(`${kindPart.replace(/_/g, "-")}-${num}`, canonical);

    if (kindPart === "white_bg") {
      register(`whitebg-${num}`, canonical);
      register(`white-bg-${num}`, canonical);
      register(`whiteBg-${num}`, canonical);
    }
  }
  return map;
}

/** 将模型返回的 id 规范化为骨架 slot id */
export function resolveProductImageSetSlotId(
  rawId: string,
  aliasMap: Map<string, string>,
  expectedIds: Set<string>,
): string | null {
  const trimmed = rawId.trim();
  if (expectedIds.has(trimmed)) return trimmed;

  const alias = aliasMap.get(trimmed.toLowerCase());
  if (alias && expectedIds.has(alias)) return alias;

  const normalized = trimmed.replace(/_/g, "-").toLowerCase();
  const alias2 = aliasMap.get(normalized);
  if (alias2 && expectedIds.has(alias2)) return alias2;

  const m = normalized.match(/^([a-z-]+)-(\d+)$/);
  if (m) {
    const kindRaw = m[1].replace(/-/g, "");
    const num = m[2];
    const kind = KIND_ALIASES[kindRaw] ?? KIND_ALIASES[m[1]];
    if (kind) {
      const candidate = `${kind}-${num}`;
      if (expectedIds.has(candidate)) return candidate;
    }
  }
  return null;
}

const RULE_TEMPLATE_SNIPPETS = [
  "电商卖点图，AI 自由排版",
  "电商场景图，比例",
  "生活化场景，产品为视觉焦点",
  "电商辅助图：尺寸图、对比图或规格说明",
  "纯白或极浅灰渐变背景，产品居中",
] as const;

/** 是否为 slot-plan 规则兜底模板（非 LLM 实质性撰写） */
export function isRuleTemplateProductImageSetPrompt(prompt: string): boolean {
  const p = prompt.trim();
  if (p.length < 40) return true;
  return RULE_TEMPLATE_SNIPPETS.some((s) => p.includes(s));
}

export function assertProductImageSetPlanPromptQuality(
  map: Map<string, { prompt: string; title?: string }>,
): void {
  const bad: string[] = [];
  for (const [id, row] of map) {
    if (isRuleTemplateProductImageSetPrompt(row.prompt)) {
      bad.push(id);
    }
  }
  if (bad.length > 0) {
    throw new Error(
      `以下槽位 Prompt 仍为系统规则模板，未按商品撰写：${bad.join(", ")}。请基于产品图与卖点重写更长、更具体的生图指令。`,
    );
  }
}

export function parseProductImageSetPlanItems(
  text: string,
  expectedIds: Set<string>,
): Map<string, { prompt: string; title?: string }> {
  const parsed = extractJsonObjectFromLlmText(text) as {
    items?: Array<{ id?: string; prompt?: string; title?: string }>;
  };
  const raw = Array.isArray(parsed.items) ? parsed.items : [];
  const aliasMap = buildProductImageSetSlotIdAliasMap(expectedIds);
  const map = new Map<string, { prompt: string; title?: string }>();

  for (const row of raw) {
    const rawId = row.id?.trim();
    const prompt = (
      row.prompt ??
      (row as { positive_prompt?: string }).positive_prompt ??
      ""
    ).trim();
    if (!rawId || !prompt) continue;
    const id = resolveProductImageSetSlotId(rawId, aliasMap, expectedIds);
    if (!id || map.has(id)) continue;
    map.set(id, {
      prompt,
      title: row.title?.trim() || undefined,
    });
  }

  if (map.size !== expectedIds.size) {
    const missing = [...expectedIds].filter((id) => !map.has(id));
    const extra = raw
      .map((r) => r.id?.trim())
      .filter((id): id is string => Boolean(id))
      .filter((id) => !resolveProductImageSetSlotId(id, aliasMap, expectedIds));
    throw new Error(
      `套图 Prompt 数量不匹配：期望 ${expectedIds.size} 条，有效 ${map.size} 条` +
        (missing.length ? `；缺少 id：${missing.join(", ")}` : "") +
        (extra.length ? `；无法识别的 id：${extra.slice(0, 5).join(", ")}` : ""),
    );
  }
  return map;
}
