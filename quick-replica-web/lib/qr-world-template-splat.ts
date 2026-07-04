import type { QrTemplate } from "@/lib/qr-template-types";
import { proxifyWorldSplatUrl } from "@/lib/qr-world-viewer-api";

function pickSpzUrl(map: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = map[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** 从模板内置 metadata 立即解析 splat 档位，点击场景墙后无需等 API 即可开载粒子。 */
export function resolveTemplateSplatUrls(
  template: QrTemplate,
  worldId: string,
): { lowResUrl: string | null; highResUrl: string | null } | null {
  const raw = template.reference.model.params.splat_urls;
  if (!raw || typeof raw !== "object") return null;
  const map = raw as Record<string, unknown>;

  const preview100k = pickSpzUrl(map, "100k");
  const fullRes = pickSpzUrl(map, "full_res");
  const lowUpstream = preview100k ?? pickSpzUrl(map, "150k");
  const highUpstream =
    fullRes ?? pickSpzUrl(map, "full_res", "500k", "3m", "150k", "100k");

  if (!lowUpstream && !highUpstream) return null;

  const progressive = Boolean(preview100k && fullRes && preview100k !== fullRes);
  const lowResUrl = progressive
    ? proxifyWorldSplatUrl(worldId, preview100k)
    : null;
  const highResUrl = proxifyWorldSplatUrl(
    worldId,
    progressive ? fullRes : (highUpstream ?? lowUpstream),
  );

  return { lowResUrl, highResUrl };
}

export function resolveTemplatePanoUrl(template: QrTemplate): string | null {
  const params = template.reference.model.params;
  const fromParams =
    typeof params.pano_url === "string" ? params.pano_url.trim() : "";
  return fromParams || null;
}
