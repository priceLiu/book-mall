import { fetchQrPlatform, formatQrPlatformError } from "@/lib/qr-platform-fetch";

export type QrWorldViewerPayload = {
  worldId: string;
  displayName: string;
  worldMarbleUrl: string;
  /** 最佳单档（向后兼容）：等同 highResSpzUrl */
  spzUrl: string | null;
  /** 低模档（150k/100k），先渲染出粒子的那份 */
  lowResSpzUrl?: string | null;
  /** 高模档（full_res/3m/500k），揭示后的清晰画质 */
  highResSpzUrl?: string | null;
  /** RAD LoD 流式资产（存在则由 Spark 内部渐进流式） */
  radUrl?: string | null;
  panoUrl: string | null;
  thumbnailUrl: string | null;
  colliderMeshUrl: string | null;
};

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
  return data;
}
