import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import {
  gatewayV1Image2ImageAsync,
  gatewayV1ImageOutPainting,
} from "@/lib/gateway/gateway-v1-http-client";
import { gatewayV1ClientMetaForBookUser } from "@/lib/gateway/gateway-log-meta-for-user";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import {
  IMAGE_ERASE_COMPLETION_MODEL,
  IMAGE_OUTPAINT_MODEL,
} from "./constants";

async function requireCanvasEditGatewayAuth(userId: string) {
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }
  if (auth.credentials.length === 0) {
    throw new GatewayRequiredError("Gateway API Key 未绑定厂商凭证");
  }
  return auth;
}

export async function invokeCanvasImageErase(opts: {
  userId: string;
  imageUrl: string;
  maskUrl: string;
  clientPage?: string;
  fastMode?: boolean;
}): Promise<{ imageUrls: string[]; logId: string }> {
  const auth = await requireCanvasEditGatewayAuth(opts.userId);
  routeGatewayModel(IMAGE_ERASE_COMPLETION_MODEL);
  if (!pickCredentialForKind(auth.credentials, "BAILIAN")) {
    throw new GatewayRequiredError("Gateway Key 未绑定百炼 / DashScope 凭证");
  }
  const parameters: Record<string, unknown> = {
    dilate_flag: true,
    fast_mode: opts.fastMode !== false,
  };
  return gatewayV1Image2ImageAsync({
    apiKeyId: auth.id,
    body: {
      model: IMAGE_ERASE_COMPLETION_MODEL,
      input: {
        image_url: opts.imageUrl,
        mask_url: opts.maskUrl,
      },
      parameters,
    },
    meta: await gatewayV1ClientMetaForBookUser("CANVAS", opts.userId, {
      clientPage: opts.clientPage,
    }),
  });
}

export async function invokeCanvasImageOutpaint(opts: {
  userId: string;
  imageUrl: string;
  parameters: Record<string, unknown>;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId: string }> {
  const auth = await requireCanvasEditGatewayAuth(opts.userId);
  routeGatewayModel(IMAGE_OUTPAINT_MODEL);
  if (!pickCredentialForKind(auth.credentials, "BAILIAN")) {
    throw new GatewayRequiredError("Gateway Key 未绑定百炼 / DashScope 凭证");
  }
  return gatewayV1ImageOutPainting({
    apiKeyId: auth.id,
    body: {
      imageUrl: opts.imageUrl,
      parameters: opts.parameters,
    },
    meta: await gatewayV1ClientMetaForBookUser("CANVAS", opts.userId, {
      clientPage: opts.clientPage,
    }),
  });
}
