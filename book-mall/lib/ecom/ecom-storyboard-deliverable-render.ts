import type {
  StoryboardAnalysisStructured,
  StoryboardDeliverable,
  StoryboardScheme,
  StoryboardSellingPoint,
} from "./ecom-storyboard-deliverable";
import {
  isLegacyAnalysisMarkdown,
  isStructuredAnalysis,
} from "./ecom-storyboard-deliverable";

function escMdCell(text: unknown): string {
  const normalized =
    text == null
      ? ""
      : typeof text === "string"
        ? text
        : typeof text === "number" && Number.isFinite(text)
          ? String(text)
          : Array.isArray(text) && text.length >= 2
            ? `${text[0]}-${text[1]}s`
            : typeof text === "object" &&
                text !== null &&
                "start" in (text as object) &&
                "end" in (text as object)
              ? `${(text as { start: unknown; end: unknown }).start}-${(text as { start: unknown; end: unknown }).end}s`
              : String(text);
  return normalized.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

const PRODUCT_INTERACTION_LABELS: Record<string, string> = {
  none: "无",
  hold: "手持",
  wear: "穿戴",
  use: "使用",
  apply: "涂抹",
  display: "展示",
  unbox: "开箱",
};

export function formatProductInteractionLabel(key?: string): string {
  if (!key) return "—";
  return PRODUCT_INTERACTION_LABELS[key] ?? key;
}

export function resolveSellpointTexts(
  tags: string[] | undefined,
  sellpoints?: StoryboardSellingPoint[],
): string {
  if (!tags?.length) return "—";
  if (!sellpoints?.length) return tags.join("、");
  const map = new Map(sellpoints.map((sp) => [sp.id, sp.text]));
  return tags.map((id) => map.get(id) ?? id).join("、");
}

export function renderAnalysisTablesMarkdown(
  analysis: StoryboardAnalysisStructured,
): string {
  const lines: string[] = [];

  lines.push("## 表1 · 目标人群精准画像", "");
  lines.push("| 人群类型 | 画像描述 |", "| --- | --- |");
  for (const row of analysis.audience) {
    lines.push(`| ${escMdCell(row.segment)} | ${escMdCell(row.description)} |`);
  }

  lines.push("", "## 表2 · 三层痛点挖掘", "");
  lines.push("| 痛点层级 | 具体描述 |", "| --- | --- |");
  for (const row of analysis.painPoints) {
    lines.push(`| ${escMdCell(row.level)} | ${escMdCell(row.description)} |`);
  }

  lines.push("", "## 表3 · 爆款内容切入策略", "");
  lines.push("| 策略 | 3秒钩子 | 中段承接 | 结尾话术 |", "| --- | --- | --- | --- |");
  for (const row of analysis.strategies) {
    lines.push(
      `| ${escMdCell(row.name)} | ${escMdCell(row.hook3s)} | ${escMdCell(row.middle)} | ${escMdCell(row.closing)} |`,
    );
  }

  return lines.join("\n");
}

export function renderSchemePanelsMarkdown(
  scheme: StoryboardScheme,
  sellpoints?: StoryboardSellingPoint[],
): string {
  const lines: string[] = [
    `### ${scheme.title}`,
    "",
  ];
  if (scheme.summary?.trim()) {
    lines.push(`**剧情亮点**：${scheme.summary.trim()}`, "");
  }
  if (scheme.strategy?.trim()) {
    lines.push(`**策略支撑**：${scheme.strategy.trim()}`, "");
  }

  lines.push(
    "| 镜号 | 时间轴 | 景别 | 运镜 | 场景 | 动作 | 产品交互 | 卖点 | 情绪 | 口播 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );

  for (const p of scheme.panels) {
    lines.push(
      `| ${p.index} | ${escMdCell(p.timeline ?? "")} | ${escMdCell(p.shotType)} | ${escMdCell(p.camera ?? "固定")} | ${escMdCell(p.scene)} | ${escMdCell(p.action)} | ${formatProductInteractionLabel(p.productInteraction)} | ${escMdCell(resolveSellpointTexts(p.sellpointTags, sellpoints))} | ${escMdCell(p.emotion ?? "")} | ${escMdCell(p.dialogue ?? "")} |`,
    );
  }

  return lines.join("\n");
}

export function renderDeliverableMarkdown(
  deliverable: StoryboardDeliverable,
  opts?: { schemeIndex?: number; includeAllSchemes?: boolean },
): string {
  const lines: string[] = [];
  const productName = deliverable.productName?.trim();
  if (productName) {
    lines.push(`# ${productName}`, "");
  }

  if (deliverable.creativeBrief) {
    const b = deliverable.creativeBrief;
    lines.push(
      "## 创意简报",
      "",
      `- **人群钩子**：${b.audienceHook}`,
      `- **爆款结构**：${b.viralStructure}`,
      `- **情景扩展**：${b.scenarioExpansion}`,
      "",
    );
  }

  if (deliverable.productSellingPoints?.length) {
    lines.push("## 产品卖点", "");
    for (const sp of deliverable.productSellingPoints) {
      const tag =
        sp.source === "inferred"
          ? "（AI 推导）"
          : sp.source === "painpoint"
            ? "（痛点映射）"
            : "";
      lines.push(`- **${sp.id}**${tag}：${sp.text}`);
    }
    lines.push("");
  }

  if (deliverable.cast?.length) {
    lines.push("## 角色设定", "");
    for (const c of deliverable.cast) {
      lines.push(
        `- **${c.name}**（${c.role}）${c.appearance ? `：${c.appearance}` : ""}`,
      );
    }
    lines.push("");
  }

  const analysis = deliverable.analysis;
  if (isStructuredAnalysis(analysis)) {
    lines.push(renderAnalysisTablesMarkdown(analysis), "");
  } else if (isLegacyAnalysisMarkdown(analysis)) {
    lines.push(
      "## 表1 · 目标人群精准画像",
      "",
      analysis.audienceMarkdown,
      "",
      "## 表2 · 三层痛点挖掘",
      "",
      analysis.painPointsMarkdown,
      "",
      "## 表3 · 爆款内容切入策略",
      "",
      analysis.strategiesMarkdown,
      "",
    );
  }

  const schemes = deliverable.schemes ?? [];
  if (schemes.length === 0) return lines.join("\n").trim();

  lines.push("## 分镜方案", "");

  if (opts?.includeAllSchemes !== false && schemes.length > 1) {
    for (const scheme of schemes) {
      lines.push(
        renderSchemePanelsMarkdown(scheme, deliverable.productSellingPoints),
        "",
      );
    }
  } else {
    const idx = opts?.schemeIndex ?? 0;
    const scheme = schemes[idx] ?? schemes[0];
    if (scheme) {
      lines.push(
        renderSchemePanelsMarkdown(scheme, deliverable.productSellingPoints),
        "",
      );
    }
  }

  return lines.join("\n").trim();
}
