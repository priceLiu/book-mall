import { fetchQrPlatform, formatQrPlatformError } from "@/lib/qr-platform-fetch";
import type { QrTemplate } from "@/lib/qr-template-types";

export type QrWorldViewerPayload = {
  worldId: string;
  displayName: string;
  worldMarbleUrl: string;
  /** 最佳单档（向后兼容）：等同 highResSpzUrl */
  spzUrl: string | null;
  /** OpenArt 预览档（100k），与 fullResSpzUrl 配对做两档渐进 */
  preview100kSpzUrl?: string | null;
  /** OpenArt 高模档（full_res） */
  fullResSpzUrl?: string | null;
  /** 低模档（100k/150k），先渲染出粒子的那份 */
  lowResSpzUrl?: string | null;
  /** 高模档（full_res/3m/500k），揭示后的清晰画质 */
  highResSpzUrl?: string | null;
  /** RAD LoD 流式资产（存在则由 Spark 内部渐进流式） */
  radUrl?: string | null;
  panoUrl: string | null;
  thumbnailUrl: string | null;
  colliderMeshUrl: string | null;
};

/** World Labs / OSS CDN 无 CORS；经 book-mall 同域代理给下载与 Spark。 */
export function proxifyWorldSplatUrl(
  worldId: string,
  upstream: string | null | undefined,
): string | null {
  const url = upstream?.trim();
  if (!url) return null;
  if (url.startsWith("/api/book-mall/")) return url;
  const q = new URLSearchParams({ url });
  return `/api/book-mall/api/platform/v1/quick-replica/worlds/${encodeURIComponent(worldId)}/splat?${q}`;
}

/** 全景图 / 缩略图等同域代理（下载全景图、避免 CORS）。 */
export function proxifyWorldImageUrl(
  worldId: string,
  upstream: string | null | undefined,
): string | null {
  const url = upstream?.trim();
  if (!url) return null;
  if (url.startsWith("/api/book-mall/")) return url;
  const q = new URLSearchParams({ url });
  return `/api/book-mall/api/platform/v1/quick-replica/worlds/${encodeURIComponent(worldId)}/image?${q}`;
}

function proxifyWorldViewerPayload(payload: QrWorldViewerPayload): QrWorldViewerPayload {
  const id = payload.worldId;
  return {
    ...payload,
    spzUrl: proxifyWorldSplatUrl(id, payload.spzUrl),
    preview100kSpzUrl: proxifyWorldSplatUrl(id, payload.preview100kSpzUrl),
    fullResSpzUrl: proxifyWorldSplatUrl(id, payload.fullResSpzUrl),
    lowResSpzUrl: proxifyWorldSplatUrl(id, payload.lowResSpzUrl),
    highResSpzUrl: proxifyWorldSplatUrl(id, payload.highResSpzUrl),
    radUrl: proxifyWorldSplatUrl(id, payload.radUrl),
    panoUrl: proxifyWorldImageUrl(id, payload.panoUrl),
    thumbnailUrl: proxifyWorldImageUrl(id, payload.thumbnailUrl),
  };
}

export async function fetchQrWorldViewerPayload(worldId: string): Promise<QrWorldViewerPayload> {
  const id = worldId.trim();
  if (!id) throw new Error("缺少 world_id");

  const res = await fetchQrPlatform(
    `/api/book-mall/api/platform/v1/quick-replica/worlds/${encodeURIComponent(id)}`,
  );
  const data = (await res.json().catch(() => null)) as
    | QrWorldViewerPayload
    | { error?: string }
    | null;

  if (!res.ok) {
    const errText =
      data && typeof data === "object"
        ? "error" in data && typeof data.error === "string"
          ? data.error
          : "message" in data && typeof data.message === "string"
            ? data.message
            : undefined
        : undefined;
    const code =
      data && typeof data === "object" && "code" in data && typeof data.code === "string"
        ? data.code
        : undefined;
    throw new Error(formatQrPlatformError(errText ?? code));
  }
  if (!data || !("worldId" in data)) {
    throw new Error("场景数据无效");
  }
  return proxifyWorldViewerPayload(data);
}

/** 修复旧场景作品缺失的 world_id 元数据 */
export async function repairQrWorldTemplate(
  templateId: string,
): Promise<{ template?: QrTemplate; error?: string }> {
  const res = await fetchQrPlatform(
    `/api/book-mall/api/platform/v1/quick-replica/templates/${encodeURIComponent(templateId)}/repair-world`,
    { method: "POST" },
  );
  const data = (await res.json().catch(() => ({}))) as {
    template?: QrTemplate;
    error?: string;
  };
  if (!res.ok || !data.template) {
    return {
      error: formatQrPlatformError(data.error) || `修复失败（${res.status}）`,
    };
  }
  return { template: data.template };
}
