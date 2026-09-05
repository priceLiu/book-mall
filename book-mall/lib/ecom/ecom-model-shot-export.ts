import { createZipArchive, formatExportTimestamp } from "@/lib/zip/create-zip-archive";

import {
  getEcomModelShotProject,
  type EcomModelShotProjectDto,
} from "@/lib/ecom/ecom-model-shot-service";
import { resolveModelShotPoseImageHistory } from "@/lib/ecom/model-shot/pose-image-history";
import { refByRole } from "@/lib/ecom/ecom-model-shot-types";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function sanitizeZipSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "服装模特图";
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

function buildManifestMarkdown(project: EcomModelShotProjectDto): string {
  const lines: string[] = [
    `# ${project.title ?? "服装模特图"}`,
    "",
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    `- 姿势数：${project.plan.items.length}`,
    `- 计划状态：${project.plan.status}`,
    "",
    "## 姿势清单",
    "",
    "| 序号 | 标题 | 成图 |",
    "| --- | --- | --- |",
  ];
  for (const item of project.plan.items) {
    const history = resolveModelShotPoseImageHistory(item);
    const url = history[history.length - 1]?.url ?? "—";
    lines.push(`| ${item.index} | ${item.title ?? "—"} | ${url} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function projectHasExportableContent(project: EcomModelShotProjectDto): boolean {
  const garment = refByRole(project.references, "garment");
  if (!garment?.ossUrl?.trim()) return false;
  return project.plan.items.length > 0;
}

export async function exportModelShotProjectZip(
  userId: string,
  projectId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const project = await getEcomModelShotProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (!projectHasExportableContent(project)) {
    throw new Error("暂无可导出内容，请先上传服装参考并生成姿势方案");
  }

  const root = sanitizeZipSegment(project.title?.trim() || "服装模特图");
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
      archive.append(JSON.stringify(project, null, 2), {
        name: `${root}/project.json`,
      });

      for (const ref of project.references) {
        if (!ref.ossUrl?.trim()) continue;
        const role = ref.role;
        try {
          const { buf, ext } = await fetchImageBuffer(ref.ossUrl);
          archive.append(buf, {
            name: `${root}/01-参考图/${role}${ext}`,
          });
        } catch (e) {
          failures.push(`参考图 ${role}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      for (const item of project.plan.items) {
        const history = resolveModelShotPoseImageHistory(item);
        const active = history[history.length - 1];
        if (!active?.url) continue;
        try {
          const { buf, ext } = await fetchImageBuffer(active.url);
          const label = sanitizeZipSegment(item.title?.trim() || `pose-${item.index}`);
          archive.append(buf, {
            name: `${root}/02-模特图/pose-${String(item.index).padStart(2, "0")}-${label}${ext}`,
          });
        } catch (e) {
          failures.push(`姿势 ${item.index}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (failures.length > 0) {
        archive.append(failures.join("\n"), { name: `${root}/00-导出警告.txt` });
      }

      archive.finalize();
    })().catch(reject);
  });

  const filename = `${root}_交付包_${formatExportTimestamp()}.zip`;
  return { buffer, filename };
}
