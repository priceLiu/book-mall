import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import {
  listStylePresets,
  resolveCatalogVersionLive,
  suggestTrendingStylePresets,
  isProVerticalId,
} from "@/lib/ecom/ecom-style-preset";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  const kindRaw = url.searchParams.get("kind");
  const kind =
    kindRaw === "sellpoint_layout" || kindRaw === "trending_visual"
      ? kindRaw
      : "sellpoint_layout";
  const verticalRaw = url.searchParams.get("vertical") ?? "generic";
  const vertical = isProVerticalId(verticalRaw) ? verticalRaw : "generic";
  const seed = url.searchParams.get("seed") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const suggest = url.searchParams.get("suggest") === "1";

  const presets = suggest
    ? await suggestTrendingStylePresets({ vertical, limit: Math.min(8, limit || 4), seed })
    : await listStylePresets({ kind, vertical, limit, seed });

  const catalogVersion = await resolveCatalogVersionLive();

  return ecomJson({
    catalogVersion,
    presets,
  });
}
