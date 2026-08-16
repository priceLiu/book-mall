import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { extractVideoFirstFrameJpeg } from "@/lib/canvas/video-poster-ffmpeg";
import {
  getEcomMediaDecomposeProject,
  updateEcomMediaDecomposeProject,
} from "@/lib/ecom/ecom-media-decompose-service";
import type { MediaDecomposeProjectDto } from "@/lib/ecom/ecom-media-decompose-types";
import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import { extractMediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import {
  createEcomSeedVideoProject,
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
  type EcomSeedVideoProjectDto,
} from "@/lib/ecom/ecom-seed-video-service";
import {
  ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL,
  type SeedVideoReference,
  type SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";

const MAX_VIDEO_FETCH_BYTES = 100 * 1024 * 1024;
const SHOT_DURATION_MIN = 3;
const SHOT_DURATION_MAX = 15;

function clampDuration(n: number, fallback = 5): number {
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(SHOT_DURATION_MIN, Math.min(SHOT_DURATION_MAX, Math.round(n)));
}

/** 解析「3s」「0-4s」「4‑9s」等分镜时长 */
export function parseMediaDecomposeShotDurationSec(raw: string, fallback = 5): number {
  const t = raw.replace(/[‑–—]/g, "-").trim();
  if (!t) return fallback;
  const range = t.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return clampDuration(Math.abs(b - a), fallback);
  }
  const single = t.match(/(\d+(?:\.\d+)?)\s*s?/i);
  if (single) return clampDuration(Number(single[1]), fallback);
  return fallback;
}

function joinPromptParts(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("，");
}

export function buildReplicaShotsFromDecompose(
  structured: MediaDecomposePatch,
  ref: SeedVideoReference,
): SeedVideoShot[] {
  if (structured.mediaType === "image") {
    const e = structured.elements;
    const sceneDescription = joinPromptParts([
      e.subject,
      e.subjectPose,
      e.sceneEnvironment,
      e.composition,
    ]);
    return [
      {
        index: 1,
        timeSlice: "0-5s",
        refImageId: ref.id,
        refImageLabel: ref.label,
        sceneDescription: sceneDescription || "静态画面复刻",
        videoPrompt: structured.positivePrompt.trim(),
        voiceover: "",
        durationSec: 5,
      },
    ];
  }

  return structured.storyboardTable.map((row, i) => {
    const index = Number.isFinite(row.shotNo) && row.shotNo > 0 ? row.shotNo : i + 1;
    const durationSec = parseMediaDecomposeShotDurationSec(row.duration, 5);
    const videoPrompt = joinPromptParts([
      row.shotSize,
      row.cameraMove,
      row.cameraAngle,
      row.composition,
      row.visualContent,
      row.characterAction,
      row.expression,
    ]);
    return {
      index,
      timeSlice: row.duration.trim() || `${index}`,
      refImageId: ref.id,
      refImageLabel: ref.label,
      sceneDescription: row.visualContent.trim() || row.characterAction.trim() || `镜头 ${index}`,
      videoPrompt: videoPrompt || row.visualContent.trim() || `镜头 ${index}`,
      voiceover: row.voiceover.trim() || row.subtitle.trim(),
      durationSec,
    };
  });
}

async function extractPosterFromVideoUrl(userId: string, videoUrl: string): Promise<string | null> {
  try {
    const res = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength <= 0 || buf.byteLength > MAX_VIDEO_FETCH_BYTES) return null;
    const jpeg = await extractVideoFirstFrameJpeg(buf);
    if (!jpeg) return null;
    return await uploadCanvasUserBuffer({
      userId,
      buf: jpeg,
      contentType: "image/jpeg",
      ext: "jpg",
      preferBucketUrl: true,
    });
  } catch {
    return null;
  }
}

async function resolveReplicaRefImage(opts: {
  userId: string;
  kind: "image" | "video";
  ossUrl: string;
  label?: string;
}): Promise<SeedVideoReference> {
  if (opts.kind === "image") {
    return {
      id: "ref-replica-1",
      label: (opts.label ?? "拆图素材").slice(0, 40),
      role: "seed-material",
      ossUrl: opts.ossUrl,
    };
  }
  const poster = await extractPosterFromVideoUrl(opts.userId, opts.ossUrl);
  if (!poster) {
    throw new Error("无法从视频截取参考帧，逐镜生视频需要一张参考图。请稍后重试，或改用图片素材。");
  }
  return {
    id: "ref-replica-1",
    label: "拆视频参考帧",
    role: "seed-material",
    ossUrl: poster,
  };
}

export function readReplicaSeedVideoProjectId(meta: Record<string, unknown> | null): string | null {
  const id = meta?.replicaSeedVideoProjectId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export async function startMediaDecomposeReplica(
  userId: string,
  projectId: string,
): Promise<{ project: MediaDecomposeProjectDto; seedVideo: EcomSeedVideoProjectDto }> {
  const decompose = await getEcomMediaDecomposeProject(userId, projectId);
  if (!decompose) throw new Error("项目不存在");
  const structured =
    decompose.result?.structured ??
    (decompose.result?.rawText ? extractMediaDecomposePatch(decompose.result.rawText) : null);
  if (!structured) {
    throw new Error("拆解结果里还没有可用的 Prompt 或分镜表，请先完成拆解后再复刻");
  }
  if (!decompose.media?.ossUrl) throw new Error("请先上传素材");

  const resultAt = decompose.result?.completedAt?.trim() || "";
  const existingId = readReplicaSeedVideoProjectId(decompose.meta);
  const existingAt =
    typeof decompose.meta?.replicaResultAt === "string" ? decompose.meta.replicaResultAt : "";

  if (existingId && existingAt === resultAt) {
    const existing = await getEcomSeedVideoProject(userId, existingId);
    if (existing?.plan?.shots?.length) {
      return { project: decompose, seedVideo: existing };
    }
  }

  const ref = await resolveReplicaRefImage({
    userId,
    kind: decompose.media.kind,
    ossUrl: decompose.media.ossUrl,
    label: decompose.media.label,
  });
  const shots = buildReplicaShotsFromDecompose(structured, ref);
  if (shots.length === 0) throw new Error("拆解结果中没有可用镜头");
  if (shots.some((s) => !s.videoPrompt.trim())) {
    throw new Error("镜头缺少视频提示词，请检查拆解结果");
  }

  const title = `拆图复刻 · ${(decompose.title?.trim() || "未命名").slice(0, 40)}`;
  const seedVideo = await createEcomSeedVideoProject(userId, { title });

  await updateEcomSeedVideoProject(userId, seedVideo.id, {
    title,
    references: [ref],
    plan: { shots },
    settings: {
      aspectRatio: "9:16",
      videoModelKey: ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL,
    },
    meta: {
      workflow: {
        phase: "production",
        productionMode: "fine",
        planSynced: true,
      },
      sourceMediaDecomposeProjectId: projectId,
    },
    status: "production",
  });

  const project = await updateEcomMediaDecomposeProject(userId, projectId, {
    meta: {
      replicaSeedVideoProjectId: seedVideo.id,
      replicaResultAt: resultAt || new Date().toISOString(),
    },
  });
  const freshSeed = await getEcomSeedVideoProject(userId, seedVideo.id);
  if (!freshSeed) throw new Error("复刻项目创建失败");
  return { project, seedVideo: freshSeed };
}
