import { createZipArchive, formatExportTimestamp } from "@/lib/zip/create-zip-archive";

import { getEcomPlatformSpec } from "@/lib/ecom/ecom-platform-spec";
import type { ProductDesign, ProductDesignChatMessage } from "@/lib/ecom/ecom-product-design-types";
import {
  getProductDesignProject,
  type EcomProductDesignProjectDto,
} from "@/lib/ecom/ecom-product-design-service";

function formatMultiValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join("、");
  if (typeof value === "string") return value.trim();
  return "";
}

function formatTrustBadge(value: unknown): string {
  const raw = formatMultiValue(value);
  if (!raw || raw === "暂无背书" || raw === "无") return "";
  return raw;
}

function buildProductDesignMarkdownExport(
  project: EcomProductDesignProjectDto,
): string {
  const spec = getEcomPlatformSpec(project.platform);
  const design = project.design;
  const lines: string[] = [
    `# ${project.title ?? "电商产品创作"}`,
    "",
    `- 平台：${spec.label}`,
    `- 主图：${project.resolved.mainImageCount} 张 · ${project.resolved.mainImageRatio}`,
    `- 详情页：${project.resolved.detailPageCount} 屏 · ${project.resolved.detailPageRatio}`,
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    "",
  ];

  const brief = project.brief;
  if (brief && typeof brief === "object") {
    lines.push("## 产品信息", "");
    const b = brief as Record<string, unknown>;
    const rows: Array<[string, string | undefined]> = [
      ["产品名", typeof b.productName === "string" ? b.productName : undefined],
      ["产品大类", typeof b.productCategory === "string" ? b.productCategory : undefined],
      ["目标人群", typeof b.targetUserGroup === "string" ? b.targetUserGroup : undefined],
      ["核心痛点", formatMultiValue(b.mainPainPoint) || undefined],
      ["核心优势", formatMultiValue(b.productCoreAdvantage) || undefined],
      ["交付形式", typeof b.deliveryType === "string" ? b.deliveryType : undefined],
      ["信任背书", formatTrustBadge(b.hasTrustBadge) || undefined],
    ];
    for (const [label, value] of rows) {
      if (value?.trim()) lines.push(`- ${label}：${value.trim()}`);
    }
    lines.push("");
  }

  if (!design) return lines.join("\n");

  appendDesignMarkdown(lines, design);
  return lines.join("\n");
}

function appendDesignMarkdown(lines: string[], design: ProductDesign): void {
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
      lines.push("### 视觉调性", "", design.analysis.visualTone, "");
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
      item.layers.bullets.forEach((bullet, i) => lines.push(`- 卖点${i + 1}：${bullet}`));
      if (item.layers.delivery) lines.push(`- 交付说明：${item.layers.delivery}`);
      if (item.layers.footer) lines.push(`- 底部收口：${item.layers.footer}`);
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
      if (item.imageUrl) lines.push(`- 成图：${item.imageUrl}`);
      lines.push("");
    }
  }
}

function buildChatHistoryMarkdown(messages: ProductDesignChatMessage[]): string {
  const lines: string[] = ["# 助手对话记录", ""];
  for (const msg of messages) {
    const role = msg.role === "user" ? "用户" : "助手";
    lines.push(`## ${role} · ${msg.createdAt}`, "", msg.content, "");
  }
  return lines.join("\n");
}

function sanitizeZipSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "project";
}

function guessExt(url: string, contentType?: string | null): string {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return ".jpg";
  if (contentType?.includes("webp")) return ".webp";
  const pathPart = url.split("?")[0] ?? "";
  const m = pathPart.match(/\.(png|jpe?g|webp|gif)$/i);
  if (m) return `.${m[1]!.toLowerCase().replace("jpeg", "jpg")}`;
  return ".png";
}

async function fetchImageBuffer(
  url: string,
  maxBytes: number,
): Promise<{ buf: Buffer; ext: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new Error(`文件过大 (${buf.byteLength} bytes)`);
  const ext = guessExt(url, r.headers.get("content-type"));
  return { buf, ext };
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export async function buildProductDesignExportZip(
  project: EcomProductDesignProjectDto,
  opts?: { productName?: string; mode?: "export" | "save" },
): Promise<{ buffer: Buffer; filename: string }> {
  const spec = getEcomPlatformSpec(project.platform);
  const briefName =
    typeof project.brief?.productName === "string"
      ? project.brief.productName.trim()
      : "";
  const labelSource =
    opts?.productName?.trim() ||
    briefName ||
    project.title?.trim() ||
    "电商产品创作";
  const root = sanitizeZipSegment(labelSource);
  const exportFailures: string[] = [];

  const readmeLines = [
    `# ${project.title ?? "电商产品创作"}`,
    "",
    `- 平台：${spec.label}`,
    `- 主图成图：${project.design?.mainImages.filter((m) => m.imageUrl).length ?? 0} 张`,
    `- 详情成图：${project.design?.detailPages.filter((d) => d.imageUrl).length ?? 0} 屏`,
    `- 参考图：${project.references.length} 张`,
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    "",
  ];

  const archive = await createZipArchive();
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    void (async () => {
      archive.append(buildProductDesignMarkdownExport(project), {
        name: `${root}/01-交互与文案/交付文案.md`,
      });
      archive.append(buildChatHistoryMarkdown(project.chatHistory), {
        name: `${root}/01-交互与文案/chat-history.md`,
      });
      archive.append(
        JSON.stringify(
          {
            title: project.title,
            platform: project.platform,
            brief: project.brief,
            settings: project.settings,
            design: project.design,
            resolved: project.resolved,
            meta: project.meta,
          },
          null,
          2,
        ),
        { name: `${root}/01-交互与文案/project.json` },
      );

      for (const item of project.design?.mainImages ?? []) {
        if (!item.imageUrl) continue;
        const label = String(item.index).padStart(2, "0");
        try {
          const { buf, ext } = await fetchImageBuffer(item.imageUrl, MAX_IMAGE_BYTES);
          archive.append(buf, { name: `${root}/02-主图/main-${label}${ext}` });
        } catch (e) {
          exportFailures.push(
            `主图 ${item.index}: ${e instanceof Error ? e.message : String(e)} (${item.imageUrl})`,
          );
        }
      }

      for (const item of project.design?.detailPages ?? []) {
        if (!item.imageUrl) continue;
        const label = String(item.index).padStart(2, "0");
        try {
          const { buf, ext } = await fetchImageBuffer(item.imageUrl, MAX_IMAGE_BYTES);
          archive.append(buf, { name: `${root}/03-详情屏/detail-${label}${ext}` });
        } catch (e) {
          exportFailures.push(
            `详情 ${item.index}: ${e instanceof Error ? e.message : String(e)} (${item.imageUrl})`,
          );
        }
      }

      for (let i = 0; i < project.references.length; i++) {
        const ref = project.references[i]!;
        try {
          const { buf, ext } = await fetchImageBuffer(ref.ossUrl, MAX_IMAGE_BYTES);
          archive.append(buf, {
            name: `${root}/04-参考图/ref-${ref.role}-${String(i + 1).padStart(2, "0")}${ext}`,
          });
        } catch (e) {
          exportFailures.push(
            `参考图 ${ref.role} #${i + 1}: ${e instanceof Error ? e.message : String(e)} (${ref.ossUrl})`,
          );
        }
      }

      if (exportFailures.length > 0) {
        readmeLines.push("## 部分资源未能打包", "");
        exportFailures.forEach((line) => readmeLines.push(`- ${line}`));
        readmeLines.push("");
      }

      archive.append(readmeLines.join("\n"), { name: `${root}/README.md` });
      await archive.finalize();
    })().catch(reject);
  });

  return {
    buffer,
    filename:
      opts?.mode === "save"
        ? `${root}_${formatExportTimestamp()}.zip`
        : `${root}-交付包.zip`,
  };
}

export async function exportProductDesignProjectZip(
  userId: string,
  projectId: string,
  opts?: { productName?: string; mode?: "export" | "save" },
): Promise<{ buffer: Buffer; filename: string }> {
  const project = await getProductDesignProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  return buildProductDesignExportZip(project, opts);
}
