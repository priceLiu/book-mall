import {
  normalizeSceneIndices,
  sanitizeSceneList,
  type SceneShot,
  type WorkflowRefs,
} from "@/lib/video-workflow/shot-spine";
import type { WorkflowEnvelope } from "@/lib/video-workflow/envelope";
import {
  outfitComposePayloadSchema,
  outfitRefsLockedPayloadSchema,
  outfitSceneSplitPayloadSchema,
  outfitScenesEditedPayloadSchema,
  outfitShotGeneratePayloadSchema,
} from "@/lib/video-workflow/templates/outfit-v1/schema";
import { OUTFIT_V1_TEMPLATE_ID } from "@/lib/video-workflow/templates/outfit-v1/constants";

export type OutfitTemplateState = {
  templateId: typeof OUTFIT_V1_TEMPLATE_ID;
  sceneList: SceneShot[];
  refs: WorkflowRefs;
  lastEnvelope: WorkflowEnvelope | null;
};

export function sceneListFromEnvelope(envelope: WorkflowEnvelope): SceneShot[] {
  const { action, payload } = envelope;
  if (action === "scene_split_complete") {
    const parsed = outfitSceneSplitPayloadSchema.safeParse(payload);
    if (parsed.success) return normalizeSceneIndices(parsed.data.sceneList);
  }
  if (action === "scenes_edited" || action === "scene_preview_regenerated") {
    const parsed = outfitScenesEditedPayloadSchema.safeParse(payload);
    if (parsed.success) return normalizeSceneIndices(parsed.data.sceneList);
  }
  if (action === "refs_locked") {
    const parsed = outfitRefsLockedPayloadSchema.safeParse(payload);
    if (parsed.success) return normalizeSceneIndices(parsed.data.sceneList);
  }
  if (action === "shot_generate_complete") {
    const parsed = outfitShotGeneratePayloadSchema.safeParse(payload);
    if (parsed.success && parsed.data.sceneResultList) {
      const byId = new Map(
        parsed.data.sceneResultList.map((r) => [r.sceneId, r] as const),
      );
      return parsed.data.sceneTaskList.map((task, i) => {
        const result = byId.get(task.sceneId);
        return {
          sceneId: task.sceneId,
          index: i + 1,
          startTimeSec: 0,
          endTimeSec: 3,
          durationSec: 3,
          previewImageUrl: task.previewImageUrl,
          keypointsUrl: task.keypointsUrl,
          videoUrl: result?.sceneVideoUrl,
          status: result?.status === "success" ? "success" : result?.status === "failed" ? "failed" : "pending",
          failReason: result?.failReason,
        } satisfies SceneShot;
      });
    }
  }
  return [];
}

export function refsFromEnvelope(envelope: WorkflowEnvelope): WorkflowRefs {
  if (envelope.action === "refs_locked") {
    const parsed = outfitRefsLockedPayloadSchema.safeParse(envelope.payload);
    if (parsed.success) return parsed.data.refs;
  }
  if (
    envelope.action === "shot_generate_complete" ||
    envelope.action === "shot_generate_request"
  ) {
    const parsed = outfitShotGeneratePayloadSchema.safeParse(envelope.payload);
    if (parsed.success) return parsed.data.refs;
  }
  return {};
}

export function parseOutfitV1Envelope(envelope: WorkflowEnvelope): {
  ok: boolean;
  sceneList?: SceneShot[];
  refs?: WorkflowRefs;
  error?: string;
} {
  if (envelope.templateId !== OUTFIT_V1_TEMPLATE_ID) {
    return { ok: false, error: "templateId 不匹配 outfit-v1" };
  }
  const sceneList = sceneListFromEnvelope(envelope);
  if (
    envelope.action === "scene_split_complete" &&
    sceneList.length === 0
  ) {
    return { ok: false, error: "scene_split_complete 缺少 sceneList" };
  }
  if (envelope.action === "compose_complete") {
    const parsed = outfitComposePayloadSchema.safeParse(envelope.payload);
    if (!parsed.success) return { ok: false, error: "compose_complete payload 无效" };
  }
  return {
    ok: true,
    sceneList: sceneList.length > 0 ? sceneList : undefined,
    refs: refsFromEnvelope(envelope),
  };
}

export function mergeSceneListWithGenerateResults(
  scenes: SceneShot[],
  results: Array<{
    sceneId: string;
    sceneVideoUrl?: string;
    status: "success" | "failed" | "processing";
    failReason?: string;
  }>,
): SceneShot[] {
  const byId = new Map(results.map((r) => [r.sceneId, r] as const));
  return normalizeSceneIndices(
    scenes.map((scene) => {
      const result = byId.get(scene.sceneId);
      if (!result) return scene;
      return {
        ...scene,
        videoUrl: result.sceneVideoUrl ?? scene.videoUrl,
        status:
          result.status === "success"
            ? "success"
            : result.status === "failed"
              ? "failed"
              : result.status === "processing"
                ? "generating"
                : scene.status,
        failReason: result.failReason ?? scene.failReason,
      };
    }),
  );
}

export function sanitizeOutfitSceneList(raw: unknown): SceneShot[] {
  return sanitizeSceneList(raw);
}
