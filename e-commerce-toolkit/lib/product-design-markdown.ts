import type { EcomPlatformSpec, ProductDesignProject } from "@/lib/product-design-types";
import { formatBriefMultiValue, formatTrustBadgeValue } from "@/lib/product-design-workflow";

/** 把 9 步交付物导出为可直接交给设计/运营的 Markdown */
export function buildProductDesignMarkdown(
  project: ProductDesignProject,
  spec: EcomPlatformSpec | null,
): string {
  const design = project.design;
  const lines: string[] = [
    `# ${project.title ?? "电商产品创作"}`,
    "",
    `- 平台：${spec?.label ?? project.platform}`,
    `- 主图：${project.resolved.mainImageCount} 张 · ${project.resolved.mainImageRatio}`,
    `- 详情页：${project.resolved.detailPageCount} 屏 · ${project.resolved.detailPageRatio}`,
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    "",
  ];

  const brief = project.brief;
  if (brief) {
    lines.push("## 产品信息", "");
    const rows: Array<[string, string | undefined]> = [
      ["产品名", brief.productName],
      ["产品大类", brief.productCategory],
      ["目标人群", brief.targetUserGroup],
      ["核心痛点", formatBriefMultiValue(brief.mainPainPoint) || undefined],
      ["核心优势", formatBriefMultiValue(brief.productCoreAdvantage) || undefined],
      ["交付形式", brief.deliveryType],
      ["信任背书", formatTrustBadgeValue(brief.hasTrustBadge) || undefined],
    ];
    for (const [label, value] of rows) {
      if (value?.trim()) lines.push(`- ${label}：${value.trim()}`);
    }
    lines.push("");
  }

  if (!design) return lines.join("\n");

  if (design.analysis) {
    lines.push("## Step1 平台合规与产品拆解", "");
    if (design.analysis.platformNotes) {
      lines.push(design.analysis.platformNotes, "");
    }
    const blocks: Array<[string, string[]]> = [
      ["表层痛点", design.analysis.surfacePainPoints],
      ["深层需求", design.analysis.deepNeeds],
      ["差异化竞争力", design.analysis.differentiators],
      ["需规避表述", design.analysis.forbiddenWords],
    ];
    for (const [title, items] of blocks) {
      if (items.length === 0) continue;
      lines.push(`### ${title}`, "");
      items.forEach((i) => lines.push(`- ${i}`));
      lines.push("");
    }
    if (design.analysis.visualTone) {
      lines.push(`### 视觉调性`, "", design.analysis.visualTone, "");
    }
  }

  if (design.marketingPlans.length > 0) {
    lines.push("## Step2 营销方案", "");
    lines.push("| 方案 | 名称 | 切入角度 | 击中痛点 | 用户收获 | 视觉情绪 |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const p of design.marketingPlans) {
      const flag = design.selectedPlanNo === p.no ? "✅ " : "";
      lines.push(
        `| ${flag}${p.no} | ${p.name} | ${p.angle} | ${p.painPoint} | ${p.outcome} | ${p.mood} |`,
      );
    }
    lines.push("");
  }

  if (design.buyingReasons.length > 0) {
    lines.push("## Step3 购买理由", "");
    design.buyingReasons.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    lines.push("");
  }

  if (design.mainImages.length > 0) {
    lines.push("## Step4-5 主图文案与配图", "");
    for (const item of design.mainImages) {
      lines.push(`### 主图 ${item.index}｜${item.purpose}`, "");
      if (item.layers.topHint) lines.push(`- 顶部引导：${item.layers.topHint}`);
      lines.push(`- 核心主标题：**${item.layers.title}**`);
      if (item.layers.subtitle) lines.push(`- 副标题：${item.layers.subtitle}`);
      item.layers.bullets.forEach((b, i) => lines.push(`- 卖点${i + 1}：${b}`));
      if (item.layers.delivery) lines.push(`- 交付说明：${item.layers.delivery}`);
      if (item.layers.footer) lines.push(`- 底部收口：${item.layers.footer}`);
      if (item.emphasis.bold.length) {
        lines.push(`- 放大加粗：${item.emphasis.bold.join("、")}`);
      }
      if (item.emphasis.color.length) {
        lines.push(`- 彩色强调：${item.emphasis.color.join("、")}`);
      }
      if (item.imageUrl) lines.push(`- 成图：${item.imageUrl}`);
      lines.push("");
    }
  }

  if (design.detailOutline.length > 0) {
    lines.push("## Step7 详情页架构", "");
    lines.push("| 屏 | 营销任务 | 解答疑虑 | 标题方向 |");
    lines.push("| --- | --- | --- | --- |");
    for (const row of design.detailOutline) {
      lines.push(
        `| ${row.index} | ${row.mission} | ${row.doubtResolved} | ${row.titleDirection} |`,
      );
    }
    lines.push("");
  }

  if (design.detailPages.length > 0) {
    lines.push("## Step8-9 详情页分屏文案与配图", "");
    for (const item of design.detailPages) {
      lines.push(`### 第 ${item.index} 屏｜${item.purpose}`, "");
      lines.push(`- 主标题：**${item.title}**`);
      item.body.forEach((b) => lines.push(`- 正文：${b}`));
      if (item.keyInfo) lines.push(`- 重点信息：${item.keyInfo}`);
      if (item.closingLine) lines.push(`- 收束金句：${item.closingLine}`);
      if (item.layoutHint) lines.push(`- 排版建议：${item.layoutHint}`);
      if (item.imageUrl) lines.push(`- 成图：${item.imageUrl}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
