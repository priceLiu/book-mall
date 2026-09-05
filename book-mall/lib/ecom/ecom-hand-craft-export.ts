import {
  HAND_CRAFT_BASE_STYLE,
  HAND_CRAFT_STEPS,
} from "@/lib/ecom/ecom-hand-craft-steps";
import {
  getEcomHandCraftProject,
  readHandCraftStepState,
  type EcomHandCraftProjectDto,
} from "@/lib/ecom/ecom-hand-craft-service";
import { createZipArchive, formatExportTimestamp } from "@/lib/zip/create-zip-archive";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function sanitizeZipSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "hand-craft";
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

async function fetchImageBuffer(url: string): Promise<{ buf: Buffer; ext: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`文件过大 (${buf.byteLength} bytes)`);
  }
  return { buf, ext: guessExt(url, r.headers.get("content-type")) };
}

function buildManifestMarkdown(project: EcomHandCraftProjectDto): string {
  const lines: string[] = [
    `# ${project.title ?? "手伴创作"}`,
    "",
    `- 线稿：${project.references.length} 张`,
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    "## 交付清单",
    "",
  ];
  for (const step of HAND_CRAFT_STEPS) {
    const state = readHandCraftStepState(project.plan, step.id);
    const done =
      step.kind === "compose"
        ? state.outputs.filter((o) => o.imageUrl).length
        : state.slots.filter((s) => s.imageUrl).length;
    const total = step.kind === "compose" ? step.pages.length : step.slots.length;
    lines.push(`### 第 ${step.no} 步 ${step.label}（${done}/${total}）`, "");
    if (step.kind === "compose") {
      for (const out of state.outputs) {
        lines.push(`- 第 ${out.index} 页 ${out.title}：${out.imageUrl}`);
      }
    } else {
      for (const slot of state.slots) {
        lines.push(
          `- #${slot.index} ${slot.title}${slot.imageUrl ? `：${slot.imageUrl}` : "（未出图）"}`,
        );
      }
    }
    lines.push("");
  }
  lines.push("## 全流程基准风格串", "", HAND_CRAFT_BASE_STYLE, "");
  return lines.join("\n");
}

function buildChatHistoryMarkdown(project: EcomHandCraftProjectDto): string {
  const lines: string[] = ["# 助手对话记录", ""];
  for (const msg of project.chatHistory) {
    lines.push(`## ${msg.role === "user" ? "用户" : "助手"} · ${msg.createdAt}`, "", msg.content, "");
  }
  return lines.join("\n");
}

/** 交付包目录：每步一个文件夹，作品集单独成册，附清单与对话记录 */
export async function exportHandCraftProjectZip(
  userId: string,
  projectId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const project = await getEcomHandCraftProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const root = sanitizeZipSegment(project.title?.trim() || "手伴创作");
  const failures: string[] = [];

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
      archive.append(buildChatHistoryMarkdown(project), {
        name: `${root}/00-助手对话.md`,
      });

      for (let i = 0; i < project.references.length; i++) {
        const ref = project.references[i]!;
        try {
          const { buf, ext } = await fetchImageBuffer(ref.ossUrl);
          archive.append(buf, {
            name: `${root}/01-线稿/sketch-${String(i + 1).padStart(2, "0")}${ext}`,
          });
        } catch (e) {
          failures.push(`线稿 #${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      for (const step of HAND_CRAFT_STEPS) {
        const state = readHandCraftStepState(project.plan, step.id);
        const dir = `${root}/${String(step.no + 1).padStart(2, "0")}-${sanitizeZipSegment(step.label)}`;
        const items =
          step.kind === "compose"
            ? state.outputs.map((o) => ({
                index: o.index,
                title: o.title,
                imageUrl: o.imageUrl,
              }))
            : state.slots.map((s) => ({
                index: s.index,
                title: s.title,
                imageUrl: s.imageUrl,
              }));
        for (const item of items) {
          if (!item.imageUrl) continue;
          const label = String(item.index).padStart(2, "0");
          try {
            const { buf, ext } = await fetchImageBuffer(item.imageUrl);
            archive.append(buf, {
              name: `${dir}/${label}-${sanitizeZipSegment(item.title)}${ext}`,
            });
          } catch (e) {
            failures.push(
              `${step.label} #${item.index}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
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
