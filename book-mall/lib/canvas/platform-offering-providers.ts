import type { CanvasModelRole } from "@prisma/client";

import type { CanvasProviderDto } from "./canvas-provider-service";
import { KIE_KNOWN_MODELS } from "./providers/kie";
import { DEEPSEEK_KNOWN_MODELS } from "./providers/deepseek-system";
import { BAILIAN_R2V_KNOWN_MODELS } from "./providers/bailian-r2v";
import { VOLCENGINE_ALL_KNOWN_MODELS } from "@/lib/gateway/volcengine-chat-models";
import { listPlatformModelsForApp } from "@/lib/platform-model/auto-publish-offerings";

export const PLATFORM_OFFERING_PROVIDER_ID = "platform:offering";

type KnownMeta = {
  modelKey: string;
  displayName: string;
  role: CanvasModelRole;
  description?: string | null;
  paramsSchema?: CanvasProviderDto["models"][0]["paramsSchema"];
  defaultParams?: Record<string, unknown> | null;
};

const KNOWN: KnownMeta[] = [
  ...KIE_KNOWN_MODELS,
  ...DEEPSEEK_KNOWN_MODELS,
  ...BAILIAN_R2V_KNOWN_MODELS,
  ...VOLCENGINE_ALL_KNOWN_MODELS,
];

function metaForModelKey(modelKey: string, fallbackName: string, role: CanvasModelRole): KnownMeta {
  const hit = KNOWN.find((m) => m.modelKey === modelKey);
  if (hit) return hit;
  return {
    modelKey,
    displayName: fallbackName,
    role,
    description: null,
    paramsSchema: null,
    defaultParams: null,
  };
}

export async function listPlatformOfferingProvidersForUser(
  userId: string,
): Promise<CanvasProviderDto[]> {
  void userId;
  const offerings = await listPlatformModelsForApp({ appKey: "canvas" });
  if (offerings.length === 0) return [];

  const now = new Date().toISOString();
  const models = offerings.map((o, idx) => {
    const meta = metaForModelKey(o.modelKey, o.displayName, o.role);
    return {
      id: `${PLATFORM_OFFERING_PROVIDER_ID}::${o.modelKey}`,
      modelKey: o.modelKey,
      displayName: o.displayName,
      role: meta.role,
      description: o.description || meta.description || null,
      paramsSchema: meta.paramsSchema ?? null,
      defaultParams: meta.defaultParams ?? null,
      enabled: true,
      sortOrder: idx,
    };
  });

  return [
    {
      id: PLATFORM_OFFERING_PROVIDER_ID,
      alias: "平台模型",
      kind: "OPENAI_COMPAT",
      baseUrl: null,
      apiKeyMasked: "platform",
      active: true,
      lastTestedAt: null,
      lastTestStatus: "platform",
      models,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function isPlatformOfferingProviderId(id: string | null | undefined): boolean {
  return id === PLATFORM_OFFERING_PROVIDER_ID;
}
