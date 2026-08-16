import { createZipArchive, formatExportTimestamp } from "@/lib/zip/create-zip-archive";

import { getEcomMediaDecomposeProject } from "@/lib/ecom/ecom-media-decompose-service";
import type { MediaDecomposeProjectDto } from "@/lib/ecom/ecom-media-decompose-types";
import { toMediaDecomposeDisplayContent } from "@/lib/ecom/ecom-media-decompose-structured";
import { getEcomSeedVideoProject } from "@/lib/ecom/ecom-seed-video-service";
import type { SeedVideoShot } from "@/lib/ecom/ecom-seed-video-types";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function sanitizeZipSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "拆图拆视频";
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

function serializeReplicaShotsMarkdown(shots: SeedVideoShot[]): string {
  const lines: string[] = [
    "## 一键复刻 · 逐镜执行表",
    "",
    "| 镜号 | 时段 | 参考图 | 场景 | 口播 | 时长(s) |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const shot of shots) {
    const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(
      `| ${shot.index} | ${esc(shot.timeSlice ?? "")} | ${esc(shot.refImageLabel ?? "")} | ${esc(shot.sceneDescription ?? "")} | ${esc(shot.voiceover ?? "")} | ${shot.durationSec ?? ""} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function projectHasExportableContent(project: MediaDecomposeProjectDto): boolean {
  if (!project.media?.ossUrl?.trim()) return false;
  const raw = project.result?.rawText?.trim() ?? "";
  const structured = project.result?.structured;
  return Boolean(raw || structured);
}

/** 交付包：源素材 + 拆解结果 + 可选复刻镜头/成片 */
export async function exportMediaDecomposeProjectZip(
  userId: string,
  projectId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const project = await getEcomMediaDecomposeProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (!projectHasExportableContent(project)) {
    throw new Error("暂无可导出内容，请先上传素材并完成拆解");
  }

  const root = sanitizeZipSegment(project.title?.trim() || "拆图拆视频");
  const failures: string[] = [];
  const archive = await createZipArchive();

  const replicaId =
    typeof project.meta?.replicaSeedVideoProjectId === "string"
      ? project.meta.replicaSeedVideoProjectId.trim()
      : "";
  const seedVideo = replicaId ? await getEcomSeedVideoProject(userId, replicaId) : null;
  const shots = seedVideo?.plan?.shots ?? [];
  const finalVideoUrl =
    seedVideo?.plan?.render?.finalVideoUrl?.trim() ||
    seedVideo?.videoOssUrl?.trim() ||
    "";

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    void (async () => {
      const manifest = [
        "# 拆图拆视频 · 交付清单",
        "",
        `- 项目：${project.title ?? "未命名"}`,
        `- 素材类型：${project.media?.kind === "video" ? "视频" : "图片"}`,
        `- 拆解指令：${project.settings.lastPrompt?.trim() || "（未保存）"}`,
        `- 一键复刻：${shots.length > 0 ? `${shots.length} 镜` : "未开启"}`,
        "",
      ].join("\n");
      archive.append(manifest, { name: `${root}/00-交付清单.md` });

      const rawText = project.result?.rawText?.trim() ?? "";
      const displayMd = rawText ? toMediaDecomposeDisplayContent(rawText) : "";
      if (displayMd) {
        archive.append(displayMd, { name: `${root}/02-拆解结果/拆解结果.md` });
      }
      archive.append(
        JSON.stringify(
          {
            title: project.title,
            media: project.media,
            settings: project.settings,
            result: project.result,
            meta: project.meta,
          },
          null,
          2,
        ),
        { name: `${root}/02-拆解结果/project.json` },
      );

      if (project.media?.ossUrl?.trim()) {
        try {
          const maxBytes = project.media.kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
          const { buf, ext } = await fetchRemoteBuffer(project.media.ossUrl.trim(), maxBytes);
          const label = project.media.kind === "video" ? "source-video" : "source-image";
          archive.append(buf, { name: `${root}/01-源素材/${label}${ext}` });
        } catch (e) {
          failures.push(
            `源素材: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      if (shots.length > 0) {
        archive.append(serializeReplicaShotsMarkdown(shots), {
          name: `${root}/03-一键复刻/逐镜执行表.md`,
        });
        archive.append(
          JSON.stringify(
            {
              references: seedVideo?.references ?? [],
              shots,
              settings: seedVideo?.settings ?? {},
            },
            null,
            2,
          ),
          { name: `${root}/03-一键复刻/replica-plan.json` },
        );

        for (const shot of shots) {
          if (!shot.videoUrl?.trim()) continue;
          const label = String(shot.index).padStart(2, "0");
          try {
            const { buf, ext } = await fetchRemoteBuffer(shot.videoUrl.trim(), MAX_VIDEO_BYTES);
            archive.append(buf, {
              name: `${root}/03-一键复刻/镜头视频/shot-${label}${ext}`,
            });
          } catch (e) {
            failures.push(
              `镜头 #${shot.index}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
      }

      if (finalVideoUrl) {
        try {
          const { buf, ext } = await fetchRemoteBuffer(finalVideoUrl, MAX_VIDEO_BYTES);
          archive.append(buf, { name: `${root}/03-一键复刻/成片/final${ext}` });
        } catch (e) {
          failures.push(
            `合成成片: ${e instanceof Error ? e.message : String(e)}`,
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
