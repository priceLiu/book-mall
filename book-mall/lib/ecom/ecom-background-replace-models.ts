import type { GatewayProviderKind } from "@prisma/client";

import { BAILIAN_IMAGE_KNOWN_MODELS } from "@/lib/canvas/providers/bailian-image";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import {
  BACKGROUND_REPLACE_MODEL_KEYS,
  resolveBackgroundReplaceModel,
  SEEDREAM_BACKGROUND_REPLACE_MODEL,
} from "@/lib/ecom/ecom-background-replace";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  registryRowsToEcomModels,
  type EcomStoryboardGatewayModel,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { isGatewayProviderBound } from "@/lib/gateway/gateway-credential-match";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { VOLCENGINE_IMAGE_KNOWN_MODELS } from "@/lib/gateway/volcengine-chat-models";

const ALLOWED = new Set<string>(BACKGROUND_REPLACE_MODEL_KEYS);

function knownImageCard(modelKey: string): {
  displayName: string;
  description: string;
} | null {
  const listed =
    BAILIAN_IMAGE_KNOWN_MODELS.find((m) => m.modelKey === modelKey) ??
    VOLCENGINE_IMAGE_KNOWN_MODELS.find((m) => m.modelKey === modelKey);
  if (!listed) return null;
  return {
    displayName: listed.displayName,
    description: listed.description ?? "",
  };
}

function providerKindForBackgroundReplace(
  _modelKey: string,
): GatewayProviderKind {
  return "VOLCENGINE";
}

function sourceLabelForBackgroundReplace(_modelKey: string): string {
  return "火山方舟";
}

/** 换背景专用清单：仅火山 Seedream 5.0 Pro。 */
export function mergeBackgroundReplaceModels(opts: {
  gatewayModels: EcomStoryboardGatewayModel[];
  boundKinds: readonly GatewayProviderKind[];
  platformOffering: boolean;
}): EcomStoryboardGatewayModel[] {
  const byKey = new Map<string, EcomStoryboardGatewayModel>();

  for (const modelKey of BACKGROUND_REPLACE_MODEL_KEYS) {
    const known = knownImageCard(modelKey);
    const providerKind = providerKindForBackgroundReplace(modelKey);
    byKey.set(modelKey, {
      modelKey,
      displayName: known?.displayName ?? modelKey,
      description: known?.description ?? "",
      role: "IMAGE",
      providerKind,
      credentialBound: isGatewayProviderBound(opts.boundKinds, providerKind),
      canonicalModelKey: modelKey,
      platformOffering: opts.platformOffering,
      sourceLabel: sourceLabelForBackgroundReplace(modelKey),
    });
  }

  for (const row of opts.gatewayModels) {
    let canonical: string;
    try {
      canonical = resolveBackgroundReplaceModel(row.modelKey);
    } catch {
      continue;
    }
    if (!ALLOWED.has(canonical)) continue;
    const base = byKey.get(canonical);
    if (!base) continue;
    byKey.set(canonical, {
      ...base,
      ...row,
      modelKey: canonical,
      displayName: row.displayName || base.displayName,
      description: row.description || base.description,
      providerKind: row.providerKind ?? base.providerKind,
      credentialBound: row.credentialBound || base.credentialBound,
      platformOffering: Boolean(row.platformOffering || base.platformOffering),
      sourceLabel: row.sourceLabel || base.sourceLabel,
    });
  }

  return BACKGROUND_REPLACE_MODEL_KEYS.map((key) => byKey.get(key)!);
}

export async function loadBackgroundReplaceModels(userId: string) {
  const persona = await getUserBillingPersona(userId);
  const platformOffering = persona === "PLATFORM_CREDIT";
  const boundKinds = platformOffering
    ? []
    : ((await resolveEcomGatewayAuthForUser(userId))?.credentials.map(
        (c) => c.providerKind,
      ) ?? []);

  const imageModels = await listModelsForApp({
    appTag: "ecom",
    role: "IMAGE",
    persona: platformOffering ? "PLATFORM_CREDIT" : "BYOK",
    boundKinds,
  });

  return {
    imageModels: mergeBackgroundReplaceModels({
      gatewayModels: registryRowsToEcomModels(imageModels),
      boundKinds,
      platformOffering,
    }),
    defaultModel: SEEDREAM_BACKGROUND_REPLACE_MODEL,
    platformOffering,
  };
}
