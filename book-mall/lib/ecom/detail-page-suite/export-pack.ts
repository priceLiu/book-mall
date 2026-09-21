import { createZipArchive, formatExportTimestamp } from "@/lib/zip/create-zip-archive";

import { resolveModuleDisplaySlots } from "./module-slots";
import {
  ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
  ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE,
  type DetailPageSuiteProject,
  type DetailPageSuiteSlot,
} from "./types";
import { getDetailPageSuiteHitProject, getDetailPageSuiteReplicaProject } from "./project-service";

function sanitizeZipSegment(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 48) || "untitled";
}

function moduleStateForWorkbenchGrid(
  mod: DetailPageSuiteProject["suite"]["modules"][number],
): DetailPageSuiteProject["suite"]["modules"][number] {
  const generate_count =
    mod.generate_count > 0
      ? mod.generate_count
      : mod.module_id === "mod7_size_table"
        ? 1
        : mod.max_num;
  const pool = mod.candidate_pool ?? [];
  const selected =
    mod.selected_item_list.length > 0
      ? mod.selected_item_list.slice(0, generate_count)
      : pool.slice(0, generate_count);
  return {
    ...mod,
    enable: mod.module_id === "mod7_size_table" ? true : mod.enable,
    generate_count,
    selected_item_list: selected,
  };
}

function resolveActiveImageUrl(slot: DetailPageSuiteSlot): string | null {
  const history =
    Array.isArray(slot.imageHistory) && slot.imageHistory.length > 0
      ? slot.imageHistory.filter((v) => v.url?.trim())
      : slot.imageUrl?.trim()
        ? [{ url: slot.imageUrl.trim() }]
        : [];
  if (history.length === 0) return null;
  const idx =
    typeof slot.activeImageIndex === "number"
      ? Math.max(0, Math.min(slot.activeImageIndex, history.length - 1))
      : history.length - 1;
  return history[idx]?.url?.trim() ?? null;
}

function guessExt(url: string, contentType: string | null): string {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return ".jpg";
  if (contentType?.includes("webp")) return ".webp";
  if (/\.png(\?|$)/i.test(url)) return ".png";
  if (/\.jpe?g(\?|$)/i.test(url)) return ".jpg";
  if (/\.webp(\?|$)/i.test(url)) return ".webp";
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
  return { buf, ext: guessExt(url, r.headers.get("content-type")) };
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const REF_ROLE_LABEL: Record<string, string> = {
  product: "产品图",
  model: "模特图",
  reference_suite: "参考详情页",
};

export async function buildDetailPageSuiteExportZip(
  project: DetailPageSuiteProject,
): Promise<{ buffer: Buffer; filename: string }> {
  const labelSource =
    project.title?.trim() ||
    (project.module === ECOM_DETAIL_PAGE_SUITE_HIT_MODULE
      ? "爆款详情页套图"
      : project.module === ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE
        ? "详情页套图复刻"
        : "详情页套图");
  const root = sanitizeZipSegment(labelSource);
  const exportFailures: string[] = [];
  const workbench =
    project.module === ECOM_DETAIL_PAGE_SUITE_HIT_MODULE ||
    project.module === ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE;

  const readmeLines = [
    `# ${labelSource}`,
    "",
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    `- 成图点位：见 02-成图/ 文件名含「模块名-点位标题」`,
    `- 参考素材：见 01-参考素材/`,
    "",
  ];

  const promptLines = ["# 出图提示词与文案", ""];

  let imageSeq = 0;
  const archive = await createZipArchive();
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    void (async () => {
      archive.append(
        JSON.stringify(
          {
            id: project.id,
            title: project.title,
            module: project.module,
            brief: project.brief,
            settings: project.settings,
            references: project.references,
            suite: project.suite,
            meta: project.meta,
          },
          null,
          2,
        ),
        { name: `${root}/project.json` },
      );

      for (let i = 0; i < project.references.length; i++) {
        const ref = project.references[i]!;
        const roleLabel = REF_ROLE_LABEL[ref.role] ?? ref.role;
        const fileStem = `${String(i + 1).padStart(2, "0")}-${roleLabel}-${sanitizeZipSegment(ref.label || ref.role)}`;
        try {
          const { buf, ext } = await fetchImageBuffer(ref.ossUrl, MAX_IMAGE_BYTES);
          archive.append(buf, { name: `${root}/01-参考素材/${fileStem}${ext}` });
        } catch (e) {
          exportFailures.push(
            `参考 ${fileStem}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      for (const mod of project.suite.modules) {
        const gridMod = workbench ? moduleStateForWorkbenchGrid(mod) : mod;
        if (!workbench && !gridMod.enable) continue;
        const slots = resolveModuleDisplaySlots(gridMod);
        for (const slot of slots) {
          const url = resolveActiveImageUrl(slot);
          if (slot.positive_prompt?.trim()) {
            promptLines.push(
              `## ${mod.module_name} · ${slot.item_label}`,
              "",
              slot.slot_copy?.trim()
                ? `**模块文案：** ${slot.slot_copy.trim()}`
                : "",
              "",
              slot.positive_prompt.trim(),
              "",
            );
          }
          if (!url) continue;
          imageSeq += 1;
          const fileStem = `${String(imageSeq).padStart(2, "0")}-${sanitizeZipSegment(mod.module_name)}-${sanitizeZipSegment(slot.item_label)}`;
          try {
            const { buf, ext } = await fetchImageBuffer(url, MAX_IMAGE_BYTES);
            archive.append(buf, { name: `${root}/02-成图/${fileStem}${ext}` });
          } catch (e) {
            exportFailures.push(
              `成图 ${fileStem}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
      }

      archive.append(promptLines.join("\n"), { name: `${root}/03-文案与提示词/prompts.md` });

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
    filename: `${root}-素材包_${formatExportTimestamp()}.zip`,
  };
}

export async function exportDetailPageSuiteProjectZip(
  userId: string,
  projectId: string,
  module: typeof ECOM_DETAIL_PAGE_SUITE_HIT_MODULE | typeof ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE,
): Promise<{ buffer: Buffer; filename: string }> {
  const project =
    module === ECOM_DETAIL_PAGE_SUITE_HIT_MODULE
      ? await getDetailPageSuiteHitProject(userId, projectId)
      : await getDetailPageSuiteReplicaProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  return buildDetailPageSuiteExportZip(project);
}
