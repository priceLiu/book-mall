import {
  getCanvasWebOrigin,
  getEcommerceWebOrigin,
  getPromptOptimizerOrigin,
  getStoryWebOrigin,
} from "@/lib/app-web-origins";
import { getToolsPublicOrigin } from "@/lib/sso-tools-env";

export type PlatformSsoApp =
  | "tool"
  | "canvas"
  | "story"
  | "prompt-optimizer"
  | "e-commerce";

/** 子应用公网 Origin（SSO callback 重定向目标）。 */
export function getPlatformAppPublicOrigin(app: PlatformSsoApp): string | null {
  switch (app) {
    case "tool":
      return getToolsPublicOrigin();
    case "canvas":
      return getCanvasWebOrigin().replace(/\/$/, "") || null;
    case "story":
      return getStoryWebOrigin().replace(/\/$/, "") || null;
    case "prompt-optimizer":
      return getPromptOptimizerOrigin().replace(/\/$/, "") || null;
    case "e-commerce":
      return getEcommerceWebOrigin().replace(/\/$/, "") || null;
    default:
      return null;
  }
}

export function parsePlatformSsoApp(raw: string | null | undefined): PlatformSsoApp {
  const v = raw?.trim().toLowerCase();
  if (v === "canvas") return "canvas";
  if (v === "story") return "story";
  if (v === "prompt-optimizer" || v === "prompt_optimizer") {
    return "prompt-optimizer";
  }
  if (v === "e-commerce" || v === "ecommerce") {
    return "e-commerce";
  }
  return "tool";
}
