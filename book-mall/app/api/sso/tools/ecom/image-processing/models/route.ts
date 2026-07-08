import { NextResponse } from "next/server";

import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  ECOM_IMAGE_PROCESSING_MODEL_KEYS,
  ECOM_OUTPAINT_MODEL_KEY,
  ECOM_WAN_I2I_MODEL_KEY,
  ECOM_WANX_PAINTING_MODEL_KEY,
  OUTPAINT_PARAM_FIELDS,
  qwenEditParamFields,
  SEEDREAM_EDITOR_PARAM_FIELDS,
  WAN_I2I_PARAM_FIELDS,
  WANX_PAINTING_PARAM_FIELDS,
} from "@/lib/ecom/ecom-image-processing-models";
import { registryRowsToEcomModels } from "@/lib/gateway/ecom-storyboard-chat-models";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

const ALLOWED = new Set<string>(ECOM_IMAGE_PROCESSING_MODEL_KEYS);

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const persona = await getUserBillingPersona(auth.userId);
  const boundKinds =
    persona === "PLATFORM_CREDIT"
      ? []
      : ((await resolveEcomGatewayAuthForUser(auth.userId))?.credentials.map(
          (c) => c.providerKind,
        ) ?? []);

  const imageModels = await listModelsForApp({
    appTag: "ecom",
    role: "IMAGE",
    persona: persona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK",
    boundKinds,
  });

  const filtered = registryRowsToEcomModels(imageModels).filter((m) =>
    ALLOWED.has(m.modelKey),
  );

  return NextResponse.json({
    imageModels: filtered,
    platformOffering: persona === "PLATFORM_CREDIT",
    paramProfiles: {
      "qwen-image-edit": qwenEditParamFields("qwen-image-edit"),
      "qwen-image-edit-max": qwenEditParamFields("qwen-image-edit-max"),
      "doubao-seedream-5-0-260128": SEEDREAM_EDITOR_PARAM_FIELDS,
      "doubao-seedream-5-0-lite": SEEDREAM_EDITOR_PARAM_FIELDS,
      [ECOM_OUTPAINT_MODEL_KEY]: OUTPAINT_PARAM_FIELDS,
      [ECOM_WANX_PAINTING_MODEL_KEY]: WANX_PAINTING_PARAM_FIELDS,
      [ECOM_WAN_I2I_MODEL_KEY]: WAN_I2I_PARAM_FIELDS,
    },
    defaults: {
      retouch: "qwen-image-edit-max",
      editor: "doubao-seedream-5-0-260128",
      enhancer: "qwen-image-edit-max",
      outpaint: ECOM_OUTPAINT_MODEL_KEY,
      restore: "qwen-image-edit-max",
      faceSwap: "qwen-image-edit-max",
      bgRemove: "qwen-image-edit-max",
      objectRemove: "doubao-seedream-5-0-lite",
      deblur: "qwen-image-edit",
      cameraAngle: "qwen-image-edit",
      poster: "doubao-seedream-5-0-lite",
      meme: "doubao-seedream-5-0-lite",
      avatar: "doubao-seedream-5-0-lite",
      gif: "doubao-seedream-5-0-lite",
    },
    modelGroups: {
      retouch: ["qwen-image-edit", "qwen-image-edit-max", ECOM_WANX_PAINTING_MODEL_KEY],
      editor: [
        "qwen-image-edit",
        "qwen-image-edit-max",
        ECOM_WAN_I2I_MODEL_KEY,
        "doubao-seedream-5-0-260128",
      ],
      enhancer: ["qwen-image-edit", "qwen-image-edit-max"],
      outpaint: [ECOM_OUTPAINT_MODEL_KEY, "qwen-image-edit", "qwen-image-edit-max"],
      restore: [
        "qwen-image-edit",
        "qwen-image-edit-max",
        "doubao-seedream-5-0-lite",
      ],
      faceSwap: [
        "qwen-image-edit",
        "qwen-image-edit-max",
        "doubao-seedream-5-0-lite",
      ],
      bgRemove: ["qwen-image-edit", "qwen-image-edit-max", "doubao-seedream-5-0-lite"],
      objectRemove: ["doubao-seedream-5-0-lite", "qwen-image-edit", "qwen-image-edit-max"],
      deblur: [
        "qwen-image-edit",
        "qwen-image-edit-max",
        "doubao-seedream-5-0-lite",
      ],
      cameraAngle: [
        "qwen-image-edit",
        "qwen-image-edit-max",
        "doubao-seedream-5-0-lite",
      ],
      poster: ["doubao-seedream-5-0-lite", "lib-nano-pro"],
      meme: ["doubao-seedream-5-0-lite", "lib-nano-pro"],
      avatar: ["doubao-seedream-5-0-lite", "lib-nano-pro"],
      gif: ["doubao-seedream-5-0-lite", "lib-nano-pro"],
    },
  });
}
