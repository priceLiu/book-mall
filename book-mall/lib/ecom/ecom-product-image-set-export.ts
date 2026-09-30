import {
  getProductImageSetProject,
} from "@/lib/ecom/product-image-set/project-service";
import type { ProductImageSetProject, ProductImageSetSlot } from "@/lib/ecom/product-image-set/types";
import { createZipArchive, formatExportTimestamp } from "@/lib/zip/create-zip-archive";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const SLOT_SECTIONS: { kind: ProductImageSetSlot["kind"]; label: string }[] = [
  { kind: "white_bg", label: "白底图" },
  { kind: "sellpoint", label: "卖点图" },
  { kind: "scene", label: "场景图" },
  { kind: "other", label: "其他" },
];

function groupSlots(slots: ProductImageSetSlot[]) {
  return SLOT_SECTIONS.map(({ kind, label }) => ({
    label,
    slots: slots.filter((s) => s.kind === kind),
  })).filter((s) => s.slots.length > 0);
}

function sanitizeZipSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "product-image-set";
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

function buildManifestMarkdown(project: ProductImageSetProject): string {
  const lines: string[] = [
    `# ${project.title ?? "AI 商品套图"}`,
    "",
    `- 商品原图：${project.references.length} 张`,
    `- 槽位：${project.output.slots.length} 个`,
    `- 已出图：${project.output.slots.filter((s) => s.imageUrl?.trim()).length} 张`,
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    "## 槽位清单",
    "",
  ];
  for (const section of groupSlots(project.output.slots)) {
    lines.push(`### ${section.label}`, "");
    for (const slot of section.slots) {
      lines.push(
        `- #${slot.index} ${slot.title}${slot.imageUrl ? `：${slot.imageUrl}` : "（未出图）"}`,
        "",
        "```",
        slot.prompt.trim() || "（无 Prompt）",
        "```",
        "",
      );
    }
  }
  if (project.output.listingCopy?.trim()) {
    lines.push("## 上架文案", "", project.output.listingCopy.trim(), "");
  }
  if (project.meta.sellpointDocument?.trim()) {
    lines.push("## 卖点文档", "", project.meta.sellpointDocument.trim(), "");
  }
  return lines.join("\n");
}

export async function exportProductImageSetProjectZip(
  userId: string,
  projectId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const project = await getProductImageSetProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const root = sanitizeZipSegment(project.title?.trim() || "AI商品套图");
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

      for (let i = 0; i < project.references.length; i++) {
        const ref = project.references[i]!;
        try {
          const { buf, ext } = await fetchImageBuffer(ref.ossUrl);
          archive.append(buf, {
            name: `${root}/01-商品原图/ref-${String(i + 1).padStart(2, "0")}${ext}`,
          });
        } catch (e) {
          failures.push(`原图 #${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      for (const section of groupSlots(project.output.slots)) {
        const dir = `${root}/02-套图/${sanitizeZipSegment(section.label)}`;
        for (const slot of section.slots) {
          if (!slot.imageUrl?.trim()) continue;
          const label = String(slot.index).padStart(2, "0");
          try {
            const { buf, ext } = await fetchImageBuffer(slot.imageUrl);
            archive.append(buf, {
              name: `${dir}/${label}-${sanitizeZipSegment(slot.title)}${ext}`,
            });
          } catch (e) {
            failures.push(
              `${section.label} #${slot.index}: ${e instanceof Error ? e.message : String(e)}`,
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
