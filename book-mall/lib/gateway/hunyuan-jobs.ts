import { prisma } from "@/lib/prisma";
import {
  Hunyuan3DGateway,
  HUNYUAN_3D_EXPRESS_MODEL_KEY,
  HUNYUAN_3D_PRO_MODEL_KEY,
} from "@/lib/canvas/providers/hunyuan-3d";
import type { CanvasProviderConfig } from "@/lib/canvas/providers/types";
import { getDecryptedCredentialApiKey } from "./credential-service";

function buildHunyuanConfig(apiKey: string, baseUrl: string | null): CanvasProviderConfig {
  return {
    apiKey,
    baseUrl: baseUrl ?? undefined,
    kind: "HUNYUAN_3D",
  } as CanvasProviderConfig;
}

export async function submitHunyuanJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  input: {
    prompt?: string;
    imageUrls?: string[];
    params?: Record<string, unknown>;
  };
}): Promise<string> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");

  const modelKey =
    opts.model === HUNYUAN_3D_EXPRESS_MODEL_KEY ||
    opts.model === HUNYUAN_3D_PRO_MODEL_KEY
      ? opts.model
      : HUNYUAN_3D_PRO_MODEL_KEY;

  const gw = new Hunyuan3DGateway(buildHunyuanConfig(cred.apiKey, cred.baseUrl));
  const task = await gw.createImageTask({
    modelKey,
    prompt: String(opts.input.prompt ?? ""),
    imageUrls: opts.input.imageUrls ?? [],
    params: opts.input.params ?? {},
  });

  if (task.mode !== "async" || !task.taskId) {
    throw new Error("混元 3D 未返回 taskId");
  }

  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: task.taskId, status: "RUNNING" },
  });
  return task.taskId;
}

export async function pollHunyuanTaskForLog(opts: {
  credentialId: string;
  taskId: string;
  model?: string;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const gw = new Hunyuan3DGateway(buildHunyuanConfig(cred.apiKey, cred.baseUrl));
  return gw.pollImageTask(opts.taskId, { modelKey: opts.model });
}
