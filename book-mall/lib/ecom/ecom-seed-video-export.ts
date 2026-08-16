import { createZipArchive, formatExportTimestamp } from "@/lib/zip/create-zip-archive";

import {
  getEcomSeedVideoProject,
  type EcomSeedVideoProjectDto,
} from "@/lib/ecom/ecom-seed-video-service";
import type {
  SeedVideoChatMessage,
  SeedVideoPlan,
  SeedVideoScript,
  SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function sanitizeZipSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "种草视频";
}

function guessExt(url: string, contentType?: string | null): string {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return ".jpg";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("mp4")) return ".mp4";
  if (contentType?.includes("webm")) return ".webm";
  if (contentType?.includes("mpeg") || contentType?.includes("mp3")) return ".mp3";
  const pathPart = url.split("?")[0] ?? "";
  const m = pathPart.match(/\.(png|jpe?g|webp|gif|mp4|webm|mov|mp3|wav)$/i);
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

function buildChatHistoryMarkdown(messages: SeedVideoChatMessage[]): string {
  const lines: string[] = ["# 助手对话记录", ""];
  for (const msg of messages) {
    lines.push(`## ${msg.role === "user" ? "用户" : "助手"} · ${msg.createdAt}`, "", msg.content, "");
  }
  return lines.join("\n");
}

function serializeScriptTable(script: SeedVideoScript): string {
  const lines: string[] = [
    `### ${script.title}`,
    "",
    `- 切入角度：${script.angle}`,
    `- 目标平台：${script.targetPlatforms.join("、")}`,
    `- 总时长：${script.totalDurationSec}s`,
    "",
    "| 节拍 | 时长(s) | 参考图 | 口播 |",
    "| --- | --- | --- | --- |",
  ];
  for (const row of script.rows) {
    const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(
      `| ${row.beatIndex} | ${row.durationSec} | ${esc(row.refImageLabel)} | ${esc(row.voiceover)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function serializeShotsTable(shots: SeedVideoShot[]): string {
  const lines: string[] = [
    "## 逐镜执行表",
    "",
    "| 镜号 | 时段 | 参考图 | 场景 | 口播 | 时长(s) |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const s of shots) {
    const esc = (v: string) => v.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(
      `| ${s.index} | ${esc(s.timeSlice)} | ${esc(s.refImageLabel)} | ${esc(s.sceneDescription)} | ${esc(s.voiceover)} | ${s.durationSec} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function buildScriptsMarkdown(project: EcomSeedVideoProjectDto): string {
  const plan = project.plan;
  const planningPrompt =
    typeof project.meta?.planningPrompt === "string"
      ? project.meta.planningPrompt.trim()
      : "";
  const lines: string[] = [`# ${project.title ?? "种草视频"}`, ""];

  if (planningPrompt) {
    lines.push("## 策划 Prompt", "", planningPrompt, "");
  }

  if (plan?.materialAnalysis) {
    const m = plan.materialAnalysis;
    lines.push("## 素材分析", "");
    if (m.productSummary) lines.push(`- 产品摘要：${m.productSummary}`);
    if (m.sellingPoints.length) lines.push(`- 卖点：${m.sellingPoints.join("、")}`);
    if (m.sceneTags.length) lines.push(`- 场景标签：${m.sceneTags.join("、")}`);
    if (m.styleTone) lines.push(`- 风格调性：${m.styleTone}`);
    lines.push("");
  }

  if (plan?.scripts?.length) {
    lines.push("## 脚本方案", "");
    for (const script of plan.scripts) {
      lines.push(serializeScriptTable(script));
    }
  }

  if (plan?.directVideo) {
    const d = plan.directVideo;
    lines.push("## 方案① · 直接成片参数", "");
    if (d.globalPrompt) lines.push(`- 全局 Prompt：${d.globalPrompt}`);
    if (d.fullVoiceover) lines.push(`- 完整口播：${d.fullVoiceover}`);
    lines.push(`- 画幅：${d.aspectRatio} · 时长 ${d.durationSec}s`);
    if (d.materialUsage) lines.push(`- 素材用法：${d.materialUsage}`);
    lines.push("");
  }

  if (plan?.shots?.length) {
    lines.push(serializeShotsTable(plan.shots));
  }

  const storyboardDraft = project.meta?.storyboardDraft;
  if (Array.isArray(storyboardDraft) && storyboardDraft.length > 0) {
    lines.push("## 分镜草稿（meta）", "", "```json", JSON.stringify(storyboardDraft, null, 2), "```", "");
  }

  return lines.join("\n");
}

function buildManifestMarkdown(project: EcomSeedVideoProjectDto, plan: SeedVideoPlan | null): string {
  const materialCount = project.references.filter((r) => r.role === "seed-material").length;
  const shotCount = plan?.shots?.length ?? 0;
  const shotVideoCount = plan?.shots?.filter((s) => s.videoUrl?.trim()).length ?? 0;
  const directVideoCount =
    (plan?.directVideo?.generatedVideos?.filter((v) => v.videoUrl?.trim()).length ?? 0) +
    (plan?.directVideo?.videoUrl?.trim() ? 1 : 0);
  const finalVideo = plan?.render?.finalVideoUrl?.trim() || project.videoOssUrl?.trim();

  const lines: string[] = [
    `# ${project.title ?? "种草视频"}`,
    "",
    `- 参考素材：${materialCount} 张`,
    `- 逐镜：${shotCount} 镜 · 镜头视频 ${shotVideoCount}`,
    `- 直接成片：${directVideoCount} 条`,
    `- 合成成片：${finalVideo ? "有" : "无"}`,
    `- 导出时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    "## 目录说明",
    "",
    "- `01-参考素材/`：种草参考图",
    "- `02-脚本/`：策划 Prompt、脚本与 project.json",
    "- `03-镜头视频/`：逐镜成片（方案②）",
    "- `04-成片/`：直接成片与最终合成",
    "- `05-配音/`：TTS 音频（如有）",
    "",
  ];
  return lines.join("\n");
}

function resolveDirectVideoUrls(plan: SeedVideoPlan | null): string[] {
  const urls: string[] = [];
  const direct = plan?.directVideo;
  if (!direct) return urls;
  if (direct.videoUrl?.trim()) urls.push(direct.videoUrl.trim());
  for (const v of direct.generatedVideos ?? []) {
    if (v.videoUrl?.trim()) urls.push(v.videoUrl.trim());
  }
  return [...new Set(urls)];
}

function projectHasExportableContent(project: EcomSeedVideoProjectDto): boolean {
  const materials = project.references.filter((r) => r.role === "seed-material");
  if (materials.length === 0) return false;
  const plan = project.plan;
  if (plan?.shots?.length) return true;
  if (plan?.scripts?.length) return true;
  if (plan?.directVideo?.globalPrompt?.trim()) return true;
  if (resolveDirectVideoUrls(plan).length > 0) return true;
  if (plan?.render?.finalVideoUrl?.trim() || project.videoOssUrl?.trim()) return true;
  if (typeof project.meta?.planningPrompt === "string" && project.meta.planningPrompt.trim()) {
    return true;
  }
  return false;
}

/** 交付包：参考素材 + 脚本 + 镜头/成片视频 + 对话记录 */
export async function exportSeedVideoProjectZip(
  userId: string,
  projectId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const project = await getEcomSeedVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (!projectHasExportableContent(project)) {
    throw new Error("暂无可导出内容，请先上传素材并确认脚本或成片");
  }

  const root = sanitizeZipSegment(project.title?.trim() || "种草视频");
  const plan = project.plan;
  const failures: string[] = [];

  const archive = await createZipArchive();
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    void (async () => {
      archive.append(buildManifestMarkdown(project, plan), {
        name: `${root}/00-交付清单.md`,
      });
      archive.append(buildChatHistoryMarkdown(project.chatHistory), {
        name: `${root}/00-助手对话.md`,
      });
      archive.append(buildScriptsMarkdown(project), {
        name: `${root}/02-脚本/脚本与策划.md`,
      });
      archive.append(
        JSON.stringify(
          {
            title: project.title,
            settings: project.settings,
            references: project.references,
            plan: project.plan,
            meta: project.meta,
            videoOssUrl: project.videoOssUrl,
          },
          null,
          2,
        ),
        { name: `${root}/02-脚本/project.json` },
      );

      const refs = project.references.filter((r) => r.role === "seed-material");
      for (let i = 0; i < refs.length; i++) {
        const ref = refs[i]!;
        try {
          const { buf, ext } = await fetchRemoteBuffer(ref.ossUrl, MAX_IMAGE_BYTES);
          archive.append(buf, {
            name: `${root}/01-参考素材/material-${String(i + 1).padStart(2, "0")}-${sanitizeZipSegment(ref.label)}${ext}`,
          });
        } catch (e) {
          failures.push(
            `参考素材 ${ref.label}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      for (const shot of plan?.shots ?? []) {
        if (shot.videoUrl?.trim()) {
          const label = String(shot.index).padStart(2, "0");
          try {
            const { buf, ext } = await fetchRemoteBuffer(shot.videoUrl, MAX_VIDEO_BYTES);
            archive.append(buf, {
              name: `${root}/03-镜头视频/shot-${label}${ext}`,
            });
          } catch (e) {
            failures.push(
              `镜头视频 #${shot.index}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
        if (shot.ttsUrl?.trim()) {
          const label = String(shot.index).padStart(2, "0");
          try {
            const { buf, ext } = await fetchRemoteBuffer(shot.ttsUrl, MAX_VIDEO_BYTES);
            archive.append(buf, {
              name: `${root}/05-配音/shot-${label}-tts${ext}`,
            });
          } catch (e) {
            failures.push(
              `配音 #${shot.index}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
      }

      const directUrls = resolveDirectVideoUrls(plan);
      for (let i = 0; i < directUrls.length; i++) {
        try {
          const { buf, ext } = await fetchRemoteBuffer(directUrls[i]!, MAX_VIDEO_BYTES);
          archive.append(buf, {
            name: `${root}/04-成片/direct-${String(i + 1).padStart(2, "0")}${ext}`,
          });
        } catch (e) {
          failures.push(
            `直接成片 #${i + 1}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      const finalUrl =
        plan?.render?.finalVideoUrl?.trim() || project.videoOssUrl?.trim();
      if (finalUrl) {
        try {
          const { buf, ext } = await fetchRemoteBuffer(finalUrl, MAX_VIDEO_BYTES);
          archive.append(buf, { name: `${root}/04-成片/final${ext}` });
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
