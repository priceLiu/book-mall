import type { ProductDesign } from "@/lib/product-design-types";

/** 去掉 machine-readable 围栏（含未闭合围栏） */
export function stripProductDesignFence(text: string): string {
  return text
    .replace(/```product-design[\s\S]*?```/gi, "")
    .replace(/```product-design[\s\S]*$/gi, "")
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*$/gi, "")
    .replace(/\n?\{\s*"analysis"\s*:[\s\S]*\}\s*$/m, "")
    .replace(/\{\s*"marketingPlans"\s*:[\s\S]*?\}\s*$/m, "")
    .replace(/\{\s*"mainImages"\s*:[\s\S]*?\}\s*$/m, "")
    .trim();
}

function formatAnalysisChatMarkdown(
  analysis: NonNullable<ProductDesign["analysis"]>,
): string {
  const lines: string[] = [
    "## Step1 · 平台合规与产品深度拆解",
    "",
    "### 平台浏览习惯与文案红线",
    analysis.platformNotes.trim() || "（见中间工作区）",
    "",
    "### 表层痛点",
    ...analysis.surfacePainPoints.map((p, i) => `${i + 1}. ${p}`),
    "",
    "### 深层隐性需求",
    ...analysis.deepNeeds.map((p, i) => `${i + 1}. ${p}`),
    "",
    "### 差异化竞争力",
    ...analysis.differentiators.map((p, i) => `${i + 1}. ${p}`),
    "",
    "### 视觉调性",
    analysis.visualTone.trim() || "—",
  ];
  if (analysis.forbiddenWords.length) {
    lines.push("", "### 需规避表述", analysis.forbiddenWords.join("、"));
  }
  lines.push("", "结构化内容已同步到中间工作区，可直接编辑；确认后点 **下一步**。");
  return lines.join("\n");
}

function formatMainImagesChatMarkdown(items: ProductDesign["mainImages"]): string {
  const lines: string[] = [
    `## Step4 · 主图分层文案（${items.length} 张定稿）`,
    "",
    "各张主图分层文案已写入中间工作区；确认后点 **下一步** 进入详情页架构。",
    "",
  ];
  for (const item of items) {
    lines.push(
      `### 主图 ${item.index} · ${item.purpose || item.layers.title}`,
      `- **主标题**：${item.layers.title}`,
    );
    if (item.layers.subtitle?.trim()) {
      lines.push(`- **副标题**：${item.layers.subtitle}`);
    }
    if (item.layers.bullets.length) {
      lines.push("- **卖点**：", ...item.layers.bullets.map((b) => `  - ${b}`));
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

/** 助手气泡展示文案 */
export function toAssistantChatContent(fullText: string): string {
  const stripped = stripProductDesignFence(fullText);
  if (stripped.length >= 40) return stripped;

  try {
    const start = fullText.indexOf("{");
    const end = fullText.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(fullText.slice(start, end + 1)) as Partial<ProductDesign>;
      if (parsed.analysis) return formatAnalysisChatMarkdown(parsed.analysis);
      if (parsed.mainImages?.length) return formatMainImagesChatMarkdown(parsed.mainImages);
      if (parsed.buyingReasons?.length) {
        return [
          "## Step3 · 购买理由",
          "",
          ...parsed.buyingReasons.map((r, i) => `${i + 1}. ${r}`),
          "",
          "已同步到中间工作区；确认后点 **下一步**。",
        ].join("\n");
      }
    }
  } catch {
    /* fall through */
  }

  if (/```product-design|```json|\{"analysis"|\{"mainImages"/.test(fullText)) {
    return "本步结构化内容已同步到中间工作区，请在左侧查看与编辑；确认后点 **下一步**。";
  }

  return stripped || fullText.trim();
}
