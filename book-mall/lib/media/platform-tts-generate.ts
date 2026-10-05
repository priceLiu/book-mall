import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertEcomToolkitGatewayAccess, resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import {
  detectQwenTtsLanguageType,
  forwardQwenTtsSpeech,
  mapVoiceToQwen,
  resolveQwenTtsUpstreamModel,
} from "@/lib/gateway/qwen-tts-proxy";

export type PlatformTtsGenerateOptions = {
  userId: string;
  text: string;
  voice?: string;
  modelKey?: string;
};

/** Gateway Qwen TTS → 用户 OSS URL（平台剪辑台 / SFV 段配音共用） */
export async function generatePlatformTtsAudioUrl(
  opts: PlatformTtsGenerateOptions,
): Promise<string> {
  const text = opts.text.trim();
  if (!text) throw new Error("口播文案不能为空");

  await assertEcomToolkitGatewayAccess(opts.userId);
  const auth = await resolveEcomGatewayAuthForUser(opts.userId);
  if (!auth) throw new Error("Gateway 未关联");
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) throw new Error("Gateway Key 未绑定 DashScope 凭证");

  const modelKey = opts.modelKey?.trim() || "qwen3-tts-flash";
  const upstreamModel = resolveQwenTtsUpstreamModel(modelKey);
  const voice = mapVoiceToQwen(opts.voice?.trim() || "Serena");

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

  return uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: result.ext,
    buf: result.buffer,
    contentType: result.contentType,
  });
}
