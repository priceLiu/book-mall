import type { IpMasterTemplate } from "@/lib/ecom/ecom-ip-master-template-schema";

export function ipMasterTemplateToMarkdown(t: IpMasterTemplate): string {
  const lines: string[] = [
    "【IP角色结构化模板】",
    `版本：${t.ipMeta.version}｜IP：${t.ipMeta.ipName}`,
    t.ipMeta.styleSummary ? `风格：${t.ipMeta.styleSummary}` : "",
    "",
    "▌刚性锚点（不可改动，带权重）",
  ].filter(Boolean);

  t.rigidFeatures.forEach((f, i) => {
    lines.push(`${i + 1}.【weight ${f.weight}】${f.featureName}：${f.description}`);
  });
  lines.push("", "▌柔性可变项（允许修改，用于系列变体）");
  t.flexibleFeatures.forEach((f, i) => {
    lines.push(`${i + 1}. ${f.featureName}：${f.description}`);
  });
  lines.push("", `▌软约束：${t.softConstraint}`);
  if (t.exceptionRule?.trim()) {
    lines.push("", "▌特例放行规则", t.exceptionRule.trim());
  }
  if (t.characterSummary?.trim()) {
    lines.push("", "▌人设摘要", t.characterSummary.trim());
  }
  if (t.pendingItems?.length) {
    lines.push("", "▌待补充", ...t.pendingItems.map((p) => `- ${p}`));
  }
  return lines.join("\n");
}

export function buildIpMasterConstraintBlockFromTemplate(
  template: IpMasterTemplate | null | undefined,
): string {
  if (!template) return "";
  const preamble =
    "严格以 IP 母版模板为唯一角色基准：刚性锚点不可改动；柔性可变项可按本次需求变更；柔性项变更不得破坏角色整体气质；特例放行规则列明的情况除外。";
  return `\n\n【IP 母版约束】\n${preamble}\n\n${ipMasterTemplateToMarkdown(template)}`;
}

/** @deprecated 兼容旧 Markdown 版本；新数据优先 JSON */
export function buildIpMasterConstraintBlock(markdown: string | undefined | null): string {
  const body = markdown?.trim();
  if (!body) return "";
  const preamble =
    "严格以 IP 母版模板为唯一角色基准：刚性锚点（标志性轮廓特征、脸型轮廓、五官相对排布、头身比）不可改动；柔性可变项（发色、肤色、服饰、表情动作）可按本次需求自由变更；柔性项变更不得破坏角色整体气质风格；特例放行规则列明的情况除外。";
  return `\n\n【IP 母版约束】\n${preamble}\n\n${body}`;
}

export function buildIpMasterConstraintForDownstream(opts: {
  template: IpMasterTemplate | null;
  markdownFallback?: string | null;
}): string {
  if (opts.template) return buildIpMasterConstraintBlockFromTemplate(opts.template);
  return buildIpMasterConstraintBlock(opts.markdownFallback);
}
