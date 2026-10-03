import type { EcomCopyImageArtifact } from "@private/ecom-copy-overlay";

import {
  getEcomPosterProject,
  type EcomPosterProjectDto,
} from "@/lib/ecom/ecom-poster-service";
import { createZipArchive, formatExportTimestamp } from "@/lib/zip/create-zip-archive";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function sanitizeZipSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "营销海报";
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

function artifactExportUrl(art: EcomCopyImageArtifact): string | null {
  const url = art.image.finalImageUrl ?? art.image.baseImageUrl;
  return url?.trim() ? url : null;
}

function buildManifestMarkdown(project: EcomPosterProjectDto): string {
  const lines: string[] = [
    `# ${project.title ?? "营销海报"}`,
    "",
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    `- 候选数：${project.plan.artifacts.length}`,
    `- 模式：${project.plan.tier === "pro" ? "专业" : "傻瓜"}`,
    "",
    "## 成图清单",
    "",
    "| 序号 | 标题 | URL |",
    "| --- | --- | --- |",
  ];
  project.plan.artifacts.forEach((art, i) => {
    const title = art.copy.slotCopy?.trim().slice(0, 40) || `海报-${i + 1}`;
    const url = artifactExportUrl(art) ?? "—";
    lines.push(`| ${i + 1} | ${title} | ${url} |`);
  });
  lines.push("");
  return lines.join("\n");
}

function projectHasExportableContent(project: EcomPosterProjectDto): boolean {
  return project.plan.artifacts.some((a) => artifactExportUrl(a) != null);
}

export async function exportPosterProjectZip(
  userId: string,
  projectId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const project = await getEcomPosterProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (!projectHasExportableContent(project)) {
    throw new Error("暂无可导出图片，请先生成或合成海报");
  }

  const root = sanitizeZipSegment(project.title?.trim() || "营销海报");
  const ts = formatExportTimestamp();
  const filename = `${root}-${ts}.zip`;
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
      archive.append(JSON.stringify(project.plan, null, 2), {
        name: `${root}/plan.json`,
      });

      for (let i = 0; i < project.plan.artifacts.length; i++) {
        const art = project.plan.artifacts[i]!;
        const url = artifactExportUrl(art);
        if (!url) continue;
        const label =
          art.copy.slotCopy?.trim().slice(0, 40) || `poster-${String(i + 1).padStart(2, "0")}`;
        const safe = sanitizeZipSegment(label);
        try {
          const { buf, ext } = await fetchImageBuffer(url);
          archive.append(buf, {
            name: `${root}/成图/${String(i + 1).padStart(2, "0")}-${safe}${ext}`,
          });
        } catch (e) {
          failures.push(`${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (failures.length > 0) {
        archive.append(failures.join("\n"), { name: `${root}/导出失败.txt` });
      }

      await archive.finalize();
    })().catch(reject);
  });

  return { buffer, filename };
}
