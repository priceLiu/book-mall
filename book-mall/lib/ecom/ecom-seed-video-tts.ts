import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertEcomToolkitGatewayAccess, resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import type { SeedVideoStylePreset } from "@/lib/ecom/ecom-seed-video-types";
import {
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
} from "@/lib/ecom/ecom-seed-video-service";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import {
  detectQwenTtsLanguageType,
  forwardQwenTtsSpeech,
  mapVoiceToQwen,
  resolveQwenTtsUpstreamModel,
} from "@/lib/gateway/qwen-tts-proxy";

const VOICE_BY_PRESET: Record<SeedVideoStylePreset, string> = {
  "sweet-xhs": "Serena",
  "sharp-douyin": "Cherry",
};

export function resolveSeedVideoVoice(stylePreset?: SeedVideoStylePreset): string {
  if (stylePreset && VOICE_BY_PRESET[stylePreset]) return VOICE_BY_PRESET[stylePreset];
  return "Serena";
}

export async function ecomGenerateSeedVideoTts(opts: {
  userId: string;
  projectId: string;
  shotIndex?: number;
  shotIndices?: number[];
  voicePreset?: SeedVideoStylePreset;
  modelKey?: string;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const project = await getEcomSeedVideoProject(opts.userId, opts.projectId);
  if (!project?.plan) throw new Error("请先完成脚本策划");

  const stylePreset =
    opts.voicePreset ??
    (project.meta?.workflow as { stylePreset?: SeedVideoStylePreset } | undefined)?.stylePreset;
  const voice = mapVoiceToQwen(resolveSeedVideoVoice(stylePreset));

  const shots = project.plan.shots ?? [];
  const indexFilter = (() => {
    if (opts.shotIndices?.length) {
      return new Set(opts.shotIndices);
    }
    if (typeof opts.shotIndex === "number") {
      return new Set([opts.shotIndex]);
    }
    return null;
  })();

  const targets = indexFilter
    ? shots.filter((s) => indexFilter.has(s.index) && s.voiceover?.trim())
    : shots.filter((s) => s.voiceover?.trim());

  if (targets.length === 0) {
    throw new Error(
      indexFilter
        ? "所选镜头没有可合成的口播文案"
        : "没有可合成的口播文案",
    );
  }

  const auth = await resolveEcomGatewayAuthForUser(opts.userId);
  if (!auth) throw new Error("Gateway 未关联");
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) throw new Error("Gateway Key 未绑定 DashScope 凭证");

  const modelKey = opts.modelKey?.trim() || "qwen3-tts-flash";
  const upstreamModel = resolveQwenTtsUpstreamModel(modelKey);

  const updated = [...shots];
  for (const shot of targets) {
    const text = shot.voiceover.trim();
    if (!text) continue;

    const result = await forwardQwenTtsSpeech({
      credentialId,
      providerKind: "DASHSCOPE",
      body: {
        model: upstreamModel,
        input: text,
        voice,
        language_type: detectQwenTtsLanguageType(text),
      },
    });

    if (result.status !== 200) {
      throw new Error(result.buffer.toString("utf8") || "TTS 生成失败");
    }

    const ttsUrl = await uploadCanvasUserBuffer({
      userId: opts.userId,
      ext: result.ext,
      buf: result.buffer,
      contentType: result.contentType,
    });

    const idx = updated.findIndex((s) => s.index === shot.index);
    if (idx >= 0) updated[idx] = { ...updated[idx]!, ttsUrl };
  }

  await updateEcomSeedVideoProject(opts.userId, opts.projectId, {
    plan: { shots: updated },
  });

  return { shots: updated.filter((s) => targets.some((t) => t.index === s.index)) };
}
