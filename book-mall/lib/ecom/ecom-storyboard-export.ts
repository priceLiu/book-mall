import { createZipArchive, formatExportTimestamp } from "@/lib/zip/create-zip-archive";

import {
  getEcomStoryboardProject,
  type EcomStoryboardProjectDto,
} from "@/lib/ecom/ecom-storyboard-service";
import { renderDeliverableMarkdown } from "@/lib/ecom/ecom-storyboard-deliverable-render";
import {
  isFashionDeliverable,
  isFashionWorkflow,
} from "@/lib/ecom/ecom-fashion-deliverable";
import { renderFashionDeliverableMarkdown } from "@/lib/ecom/ecom-fashion-deliverable-render";
import type { StoryboardChatMessage } from "@/lib/ecom/ecom-storyboard-types";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function sanitizeZipSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "微剧故事版";
}

function guessExt(url: string, contentType?: string | null): string {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return ".jpg";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("mp4")) return ".mp4";
  if (contentType?.includes("webm")) return ".webm";
  const pathPart = url.split("?")[0] ?? "";
  const m = pathPart.match(/\.(png|jpe?g|webp|gif|mp4|webm|mov)$/i);
  if (m) return `.${m[1]!.toLowerCase().replace("jpeg", "jpg")}`;
  return ".bin";
}

async function fetchRemoteBuffer(
  url: string,
  maxBytes: number,
): Promise<{ buf: Buffer; ext: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new Error(`文件过大 (${buf.byteLength} bytes)`);
  }
  return { buf, ext: guessExt(url, r.headers.get("content-type")) };
}

function buildChatHistoryMarkdown(messages: StoryboardChatMessage[]): string {
  const lines: string[] = ["# 助手对话记录", ""];
  for (const msg of messages) {
    lines.push(`## ${msg.role === "user" ? "用户" : "助手"} · ${msg.createdAt}`, "", msg.content, "");
  }
  return lines.join("\n");
}

function buildStoryboardSheetMarkdown(project: EcomStoryboardProjectDto): string {
  const metaRecord = (project.meta as Record<string, unknown> | null) ?? {};
  if (isFashionWorkflow(metaRecord)) {
    const deliverable = project.meta?.deliverable;
    if (isFashionDeliverable(deliverable)) {
      return renderFashionDeliverableMarkdown(deliverable, {
        versionKey: deliverable.selectedVersion ?? undefined,
        includeAllVersions: !deliverable.selectedVersion,
      });
    }
  }

  const deliverable = project.meta?.deliverable;
  if (deliverable?.schemes?.length) {
    const idx = project.meta?.selectedSchemeIndex ?? 0;
    return renderDeliverableMarkdown(deliverable, {
      schemeIndex: idx,
      includeAllSchemes: true,
    });
  }

  const sheet = project.sheet;
  const deliverableMd = project.meta?.deliverableMarkdown?.trim();
  if (!sheet) return deliverableMd ?? "";

  const lines: string[] = [
    `# ${sheet.overview.title}`,
    "",
    `> ${sheet.overview.logline}`,
    "",
  ];
  if (sheet.overview.productHighlight?.trim()) {
    lines.push(`**卖点**：${sheet.overview.productHighlight.trim()}`, "");
  }
  if (sheet.cast.length > 0) {
    lines.push("## 角色", "");
    for (const c of sheet.cast) {
      const appearance = c.appearance?.trim();
      lines.push(
        `- **${c.name}**（${c.role}）${appearance ? `：${appearance}` : ""}`,
      );
    }
    lines.push("");
  }
  lines.push("## 分镜表", "");
  lines.push(
    "| 镜号 | 景别 | 场景 | 动作 | 产品交互 | 台词 | 时长(s) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const p of sheet.panels) {
    const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(
      `| ${p.index} | ${esc(p.shotType)} | ${esc(p.scene)} | ${esc(p.action)} | ${esc(p.productInteraction ?? "")} | ${esc(p.dialogue ?? "")} | ${p.durationHintSec ?? ""} |`,
    );
  }
  return lines.join("\n");
}

function buildManifestMarkdown(project: EcomStoryboardProjectDto): string {
  const sheet = project.sheet;
  const panelCount = sheet?.panels.length ?? 0;
  const imageCount = sheet?.panels.filter((p) => p.imageUrl?.trim()).length ?? 0;
  const panelVideoCount = sheet?.panels.filter((p) => p.videoUrl?.trim()).length ?? 0;
  const lines: string[] = [
    `# ${project.title ?? "微剧故事版"}`,
    "",
    `- 参考图：${project.references.length} 张`,
    `- 分镜：${panelCount} 镜 · 成图 ${imageCount} · 镜头视频 ${panelVideoCount}`,
    `- 成片：${project.videoOssUrl?.trim() ? "有" : "无"}`,
    `- 分镜长图：${project.sheetPngUrl?.trim() ? "有" : "无"}`,
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    "## 目录说明",
    "",
    "- `01-参考图/`：角色 / 产品 / 场景参考",
    "- `02-分镜脚本/`：Markdown 分镜表与 project.json",
    "- `03-分镜图/`：各镜头成图",
    "- `04-镜头视频/`：单镜视频",
    "- `05-成片/`：整片或合并视频",
    "- `06-分镜长图/`：HTML 分镜表导出 PNG",
    "",
  ];
  return lines.join("\n");
}

function projectHasExportableContent(project: EcomStoryboardProjectDto): boolean {
  if (project.references.length > 0) return true;
  if (project.meta?.deliverableMarkdown?.trim()) return true;
  if (project.sheet?.panels.length) return true;
  if (project.videoOssUrl?.trim()) return true;
  if (project.sheetPngUrl?.trim()) return true;
  if (project.chatHistory.length > 0) return true;
  return false;
}

/** 交付包：参考图 + 分镜脚本 + 分镜图/视频 + 成片 + 对话记录 */
export async function exportStoryboardProjectZip(
  userId: string,
  projectId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const project = await getEcomStoryboardProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (!projectHasExportableContent(project)) {
    throw new Error("暂无可导出内容，请先上传参考图或生成分镜");
  }

  const root = sanitizeZipSegment(project.title?.trim() || "微剧故事版");
  const failures: string[] = [];
  const sheet = project.sheet;

  const archive = await createZipArchive();
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    void (async () => {
      archive.append(buildManifestMarkdown(project), {
        name: `${root}/00-交付清单.md`,
      });
      archive.append(buildChatHistoryMarkdown(project.chatHistory), {
        name: `${root}/00-助手对话.md`,
      });
      archive.append(buildStoryboardSheetMarkdown(project), {
        name: `${root}/02-分镜脚本/分镜脚本.md`,
      });
      archive.append(
        JSON.stringify(
          {
            title: project.title,
            settings: project.settings,
            references: project.references,
            sheet: project.sheet,
            meta: project.meta,
            sheetPngUrl: project.sheetPngUrl,
            videoOssUrl: project.videoOssUrl,
          },
          null,
          2,
        ),
        { name: `${root}/02-分镜脚本/project.json` },
      );

      for (let i = 0; i < project.references.length; i++) {
        const ref = project.references[i]!;
        try {
          const { buf, ext } = await fetchRemoteBuffer(ref.ossUrl, MAX_IMAGE_BYTES);
          archive.append(buf, {
            name: `${root}/01-参考图/${ref.role}-${String(i + 1).padStart(2, "0")}-${sanitizeZipSegment(ref.label)}${ext}`,
          });
        } catch (e) {
          failures.push(
            `参考图 ${ref.label}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      if (sheet) {
        for (const panel of sheet.panels) {
          if (panel.imageUrl?.trim()) {
            const label = String(panel.index).padStart(2, "0");
            try {
              const { buf, ext } = await fetchRemoteBuffer(panel.imageUrl, MAX_IMAGE_BYTES);
              archive.append(buf, {
                name: `${root}/03-分镜图/panel-${label}${ext}`,
              });
            } catch (e) {
              failures.push(
                `分镜图 #${panel.index}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
          if (panel.videoUrl?.trim()) {
            const label = String(panel.index).padStart(2, "0");
            try {
              const { buf, ext } = await fetchRemoteBuffer(panel.videoUrl, MAX_VIDEO_BYTES);
              archive.append(buf, {
                name: `${root}/04-镜头视频/panel-${label}${ext}`,
              });
            } catch (e) {
              failures.push(
                `镜头视频 #${panel.index}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
        }
      }

      if (project.videoOssUrl?.trim()) {
        try {
          const { buf, ext } = await fetchRemoteBuffer(project.videoOssUrl, MAX_VIDEO_BYTES);
          archive.append(buf, { name: `${root}/05-成片/final${ext}` });
        } catch (e) {
          failures.push(
            `成片: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      if (project.sheetPngUrl?.trim()) {
        try {
          const { buf, ext } = await fetchRemoteBuffer(project.sheetPngUrl, MAX_IMAGE_BYTES);
          archive.append(buf, { name: `${root}/06-分镜长图/sheet${ext}` });
        } catch (e) {
          failures.push(
            `分镜长图: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      if (failures.length > 0) {
        archive.append(
          ["# 部分资源未能打包", "", ...failures.map((f) => `- ${f}`), ""].join("\n"),
          { name: `${root}/00-未打包资源.md` },
        );
      }

      await archive.finalize();
    })().catch(reject);
  });

  return { buffer, filename: `${root}-交付包_${formatExportTimestamp()}.zip` };
}
