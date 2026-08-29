import type {
  FashionDeliverable,
  FashionPanelRow,
  FashionSellpoint,
  FashionStoryboardVersion,
  FashionVersionKey,
} from "./ecom-fashion-deliverable";

function escMdCell(text: unknown): string {
  const normalized =
    text == null
      ? ""
      : typeof text === "string"
        ? text
        : Array.isArray(text)
          ? text.join("、")
          : String(text);
  return normalized.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

const LAYER_LABELS: Record<string, string> = {
  core: "核心",
  visual: "视觉",
  aux: "辅助",
};

function coerceOpsPackText(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw == null) return "";
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const text =
      (typeof o.text === "string" && o.text.trim()) ||
      (typeof o.title === "string" && o.title.trim()) ||
      (typeof o.label === "string" && o.label.trim()) ||
      (typeof o.content === "string" && o.content.trim()) ||
      "";
    const type = typeof o.type === "string" ? o.type.trim() : "";
    if (text && type) return `${type}：${text}`;
    return text;
  }
  return String(raw).trim();
}

function coerceStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceOpsPackText).filter(Boolean);
}

export function renderFashionParamsMarkdown(deliverable: FashionDeliverable): string {
  const d = deliverable.dimensions;
  const lines = [
    "## 产品参数档案",
    "",
    "| 参数 | 值 |",
    "| --- | --- |",
    `| 性别品类 | ${escMdCell(d.genderCategory)} |`,
    `| 款式品类 | ${escMdCell(d.styleCategory)} |`,
    `| 风格属性 | ${escMdCell(d.styleAttribute)} |`,
    `| 档次定位 | ${escMdCell(d.tier)} |`,
    `| 自定义场景 | ${escMdCell(d.customScene)} |`,
    `| 发布平台 | ${escMdCell(d.platform)} |`,
    `| 输出语言 | ${escMdCell(d.outputLanguage)} |`,
    "",
  ];
  return lines.join("\n");
}

export function renderFashionSellpointsMarkdown(sellpoints: FashionSellpoint[]): string {
  if (!sellpoints.length) return "";
  const lines = [
    "## 定稿卖点清单",
    "",
    "| ID | 卖点 | 分层 | 来源 |",
    "| --- | --- | --- | --- |",
  ];
  for (const sp of sellpoints) {
    lines.push(
      `| ${escMdCell(sp.id)} | ${escMdCell(sp.text)} | ${escMdCell(LAYER_LABELS[sp.layer] ?? sp.layer)} | ${escMdCell(sp.source)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function renderFashionVoiceoversMarkdown(
  deliverable: FashionDeliverable,
): string {
  if (!deliverable.voiceovers.length) return "";
  const lines = ["## 口播文案（6 套）", ""];
  for (const v of deliverable.voiceovers) {
    const selected = v.id === deliverable.selectedVoiceoverId ? " ✅" : "";
    lines.push(`### ${v.type}${selected}`, "", `**叙事**：${v.narrative}`, "", v.script, "");
  }
  return lines.join("\n");
}

export function renderFashionPanelsTableMarkdown(
  version: FashionStoryboardVersion,
  sellpoints?: FashionSellpoint[],
): string {
  const spMap = new Map((sellpoints ?? []).map((sp) => [sp.id, sp.text]));
  const lines = [
    `### ${version.title}`,
    "",
    "| 镜号 | 景别 | 时长 | 运镜 | 场景 | 动作 | 展示重点 | 口播 | 色调质感 | 卖点ID |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const p of version.panels) {
    const spTexts = p.sellpointIds
      .map((id) => spMap.get(id) ?? id)
      .join("、");
    lines.push(
      `| ${p.index} | ${escMdCell(p.shotScale)} | ${p.durationSec}s | ${escMdCell(p.cameraMove)} | ${escMdCell(p.sceneDesc)} | ${escMdCell(p.modelAction)} | ${escMdCell(p.garmentFocus)} | ${escMdCell(p.dialogue)} | ${escMdCell(p.toneTexture)} | ${escMdCell(spTexts || p.sellpointIds.join(","))} |`,
    );
  }
  const total = version.panels.reduce((s, p) => s + p.durationSec, 0);
  lines.push(`| **合计** | — | **${total}s** | — | — | — | — | — | — | — |`, "");
  return lines.join("\n");
}

export function renderFashionCoverageChecklistMarkdown(
  deliverable: FashionDeliverable,
): string {
  const rows = deliverable.coverageChecklist;
  if (!rows.length && deliverable.sellpoints.length) {
    return renderFashionCoverageFromSellpoints(deliverable);
  }
  if (!rows.length) return "";
  const lines = [
    "## 12.3 · 卖点覆盖率验收清单",
    "",
    "| 卖点ID | 卖点内容 | 分层 | 所在镜号 | 是否落地 |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${escMdCell(row.sellpointId)} | ${escMdCell(row.sellpointText)} | ${escMdCell(LAYER_LABELS[row.layer] ?? row.layer)} | ${escMdCell(row.panelIndexes.join(","))} | ${row.covered ? "✅" : "❌"} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderFashionCoverageFromSellpoints(deliverable: FashionDeliverable): string {
  const versionKey = deliverable.selectedVersion;
  const panels =
    (versionKey && deliverable.storyboardVersions?.[versionKey]?.panels) ?? [];
  const lines = [
    "## 12.3 · 卖点覆盖率验收清单",
    "",
    "| 卖点ID | 卖点内容 | 分层 | 所在镜号 | 是否落地 |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const sp of deliverable.sellpoints) {
    if (sp.layer === "aux") continue;
    const indexes = panels
      .filter((p: FashionPanelRow) => p.sellpointIds.includes(sp.id))
      .map((p: FashionPanelRow) => p.index);
    lines.push(
      `| ${escMdCell(sp.id)} | ${escMdCell(sp.text)} | ${escMdCell(LAYER_LABELS[sp.layer] ?? sp.layer)} | ${escMdCell(indexes.join(","))} | ${indexes.length ? "✅" : "❌"} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function renderFashionOpsPackMarkdown(deliverable: FashionDeliverable): string {
  const ops = deliverable.opsPack;
  if (!ops) return "";
  const lines = ["## 运营素材包", ""];
  const titles = coerceStringList(ops.titles);
  if (titles.length) lines.push("**爆款标题**", ...titles.map((t) => `- ${t}`), "");
  const coverWords = coerceStringList(ops.coverWords);
  if (coverWords.length) lines.push("**封面词**", ...coverWords.map((t) => `- ${t}`), "");
  const tags = coerceStringList(ops.tags);
  if (tags.length) lines.push("**标签**", tags.join(" "), "");
  const body = coerceOpsPackText(ops.xiaohongshuBody);
  if (body) lines.push("**小红书正文**", "", body, "");
  const detailBullets = coerceStringList(ops.detailBullets);
  if (detailBullets.length) lines.push("**详情要点**", ...detailBullets.map((t) => `- ${t}`), "");
  return lines.join("\n").trim();
}

export function renderFashionDeliverableMarkdown(
  deliverable: FashionDeliverable,
  opts?: { versionKey?: FashionVersionKey; includeAllVersions?: boolean },
): string {
  const parts: string[] = [
    `# ${deliverable.productName} · 服装专业版交付物`,
    "",
    renderFashionParamsMarkdown(deliverable),
    renderFashionSellpointsMarkdown(deliverable.sellpoints),
    renderFashionVoiceoversMarkdown(deliverable),
  ];

  const versions = deliverable.storyboardVersions ?? {};
  const versionKeys = (["A", "B", "C", "D", "E"] as FashionVersionKey[]).filter(
    (k) => versions[k],
  );

  if (versionKeys.length) {
    parts.push("## 12.1 · 分镜脚本表", "");
    if (opts?.includeAllVersions) {
      for (const k of versionKeys) {
        parts.push(renderFashionPanelsTableMarkdown(versions[k]!, deliverable.sellpoints));
      }
    } else {
      const key = opts?.versionKey ?? deliverable.selectedVersion ?? versionKeys[0];
      if (key && versions[key]) {
        parts.push(renderFashionPanelsTableMarkdown(versions[key]!, deliverable.sellpoints));
      }
    }
  }

  parts.push(renderFashionCoverageChecklistMarkdown(deliverable));
  parts.push(renderFashionOpsPackMarkdown(deliverable));

  if (deliverable.outputMode) {
    parts.push(
      "",
      `**成片方式**：${deliverable.outputMode === "script_compose" ? "分镜脚本交付（路径 A）" : "故事版一键成片（路径 B）"}`,
      "",
    );
  }

  return parts.filter(Boolean).join("\n").trim();
}
