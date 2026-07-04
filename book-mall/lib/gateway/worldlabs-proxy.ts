/**
 * World Labs Marble API proxy (api.worldlabs.ai)
 * @see https://docs.worldlabs.ai/api/world-generation-examples
 */

import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";

export const WORLDLABS_DEFAULT_API_ROOT = "https://api.worldlabs.ai";

export type WorldlabsContentRef =
  | { source: "uri"; uri: string }
  | { source: "data_base64"; data_base64: string; extension?: string }
  | { source: "media_asset"; media_asset_id: string };

export type WorldlabsWorldPrompt =
  | { type: "text"; text_prompt: string }
  | {
      type: "image";
      image_prompt: WorldlabsContentRef;
      text_prompt?: string;
      is_pano?: boolean | "auto";
    }
  | {
      type: "multi-image";
      multi_image_prompt: Array<{ azimuth?: number | null; content: WorldlabsContentRef }>;
      text_prompt?: string;
      reconstruct_images?: boolean;
    }
  | {
      type: "video";
      video_prompt: WorldlabsContentRef;
      text_prompt?: string;
    };

export type WorldlabsGenerateRequest = {
  display_name?: string;
  model: string;
  world_prompt: WorldlabsWorldPrompt;
  tags?: string[];
};

export type WorldlabsListWorldsRequest = {
  page_size?: number;
  page_token?: string | null;
  status?: "SUCCEEDED" | "PENDING" | "FAILED" | "RUNNING" | null;
  sort_by?: "created_at" | "updated_at";
  is_public?: boolean | null;
  tags?: string[] | null;
};

/**
 * Marble 前端实际会消费的全部 SPZ 档位（逆向自 marble.worldlabs.ai
 * splat-files chunk 的 getUrls）：低模 150k/100k，高模 full_res/3m/500k，
 * 以及可选的 rad（RAD LoD 流式资产）。
 */
export type WorldlabsSpzUrls = Partial<
  Record<"100k" | "150k" | "500k" | "full_res" | "3m" | "rad", string | null>
>;

export type WorldlabsWorldAssets = {
  thumbnail_url?: string | null;
  caption?: string | null;
  imagery?: { pano_url?: string | null } | null;
  splats?: {
    spz_urls?: WorldlabsSpzUrls | null;
  } | null;
  mesh?: {
    collider_mesh_url?: string | null;
  } | null;
};

export type WorldlabsWorld = {
  world_id: string;
  display_name: string;
  world_marble_url: string;
  model?: string | null;
  tags?: string[] | null;
  assets?: WorldlabsWorldAssets | null;
  world_prompt?: unknown;
};

export type WorldlabsOperation = {
  operation_id: string;
  done: boolean;
  error?: { message?: string; code?: string } | null;
  response?: unknown;
  metadata?: Record<string, unknown> | null;
};

export function resolveWorldlabsApiRoot(baseUrl?: string | null): string {
  const raw = (baseUrl?.trim() || WORLDLABS_DEFAULT_API_ROOT).replace(/\/$/, "");
  return raw || WORLDLABS_DEFAULT_API_ROOT;
}

export function worldlabsAuthHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "WLT-Api-Key": apiKey,
  };
}

async function readWorldlabsJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function operationErrorMessage(op: WorldlabsOperation): string | null {
  if (!op.error) return null;
  if (typeof op.error === "object" && op.error && "message" in op.error) {
    const msg = (op.error as { message?: string }).message;
    if (msg?.trim()) return msg.trim();
  }
  return "World generation failed";
}

export async function forwardWorldlabsGenerateWorld(args: {
  credentialId: string;
  body: WorldlabsGenerateRequest;
  baseUrlOverride?: string | null;
}): Promise<{ status: number; operation: WorldlabsOperation; vendorJson: unknown }> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("World Labs 凭证不可用");

  const root = resolveWorldlabsApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/marble/v1/worlds:generate`;
  const r = await fetch(url, {
    method: "POST",
    headers: worldlabsAuthHeaders(cred.apiKey),
    body: JSON.stringify(args.body),
  });
  const vendorJson = await readWorldlabsJson(r);
  const operation = vendorJson as WorldlabsOperation;
  if (!r.ok) {
    const detail =
      vendorJson &&
      typeof vendorJson === "object" &&
      "detail" in vendorJson &&
      typeof (vendorJson as { detail?: unknown }).detail === "string"
        ? String((vendorJson as { detail: string }).detail)
        : `World Labs HTTP ${r.status}`;
    throw new Error(detail);
  }
  if (!operation.operation_id) {
    throw new Error("World Labs 未返回 operation_id");
  }
  return { status: r.status, operation, vendorJson };
}

export async function forwardWorldlabsGetOperation(args: {
  credentialId: string;
  operationId: string;
  baseUrlOverride?: string | null;
}): Promise<{ status: number; operation: WorldlabsOperation; vendorJson: unknown }> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("World Labs 凭证不可用");

  const root = resolveWorldlabsApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/marble/v1/operations/${encodeURIComponent(args.operationId)}`;
  const r = await fetch(url, {
    method: "GET",
    headers: worldlabsAuthHeaders(cred.apiKey),
  });
  const vendorJson = await readWorldlabsJson(r);
  const operation = vendorJson as WorldlabsOperation;
  if (!r.ok) {
    const detail =
      vendorJson &&
      typeof vendorJson === "object" &&
      "detail" in vendorJson &&
      typeof (vendorJson as { detail?: unknown }).detail === "string"
        ? String((vendorJson as { detail: string }).detail)
        : `World Labs HTTP ${r.status}`;
    throw new Error(detail);
  }
  return { status: r.status, operation, vendorJson };
}

export async function forwardWorldlabsGetWorld(args: {
  credentialId: string;
  worldId: string;
  baseUrlOverride?: string | null;
}): Promise<{ status: number; world: WorldlabsWorld; vendorJson: unknown }> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("World Labs 凭证不可用");

  const root = resolveWorldlabsApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/marble/v1/worlds/${encodeURIComponent(args.worldId)}`;
  const r = await fetch(url, {
    method: "GET",
    headers: worldlabsAuthHeaders(cred.apiKey),
  });
  const vendorJson = await readWorldlabsJson(r);
  if (!r.ok) {
    const detail =
      vendorJson &&
      typeof vendorJson === "object" &&
      "detail" in vendorJson &&
      typeof (vendorJson as { detail?: unknown }).detail === "string"
        ? String((vendorJson as { detail: string }).detail)
        : `World Labs HTTP ${r.status}`;
    throw new Error(detail);
  }
  const world = vendorJson as WorldlabsWorld;
  if (!world?.world_id) {
    throw new Error("World Labs 未返回 world 详情");
  }
  return { status: r.status, world, vendorJson };
}

export type WorldlabsSplatQuality = "100k" | "150k" | "500k" | "full_res" | "3m" | "rad";

function pickSpzUrl(urls: WorldlabsSpzUrls, prefer: WorldlabsSplatQuality[]): string | null {
  for (const key of prefer) {
    const url = urls[key];
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return null;
}

/** Pick best available SPZ URL for in-browser Spark viewer (highest quality first). */
export function extractWorldSplatUrl(
  world: WorldlabsWorld,
  prefer: WorldlabsSplatQuality[] = ["full_res", "3m", "500k", "150k", "100k"],
): string | null {
  const urls = world.assets?.splats?.spz_urls;
  if (!urls || typeof urls !== "object") return null;
  return pickSpzUrl(urls, prefer);
}

export type WorldlabsSplatTiers = {
  /** 低模：优先 150k，其次 100k（先渲染出发光粒子的那份） */
  lowRes: string | null;
  /** 目标高模（桌面）：full_res → 3m → 500k */
  highRes: string | null;
  /** RAD LoD 流式资产（存在时 Spark 内部渐进流式，无需两档） */
  radUrl: string | null;
};

/**
 * 复刻 Marble getUrls 的档位选择，供前端两档渐进加载使用。
 * @see marble.worldlabs.ai splat-files chunk
 */
export function extractWorldSplatTiers(world: WorldlabsWorld): WorldlabsSplatTiers {
  const urls = world.assets?.splats?.spz_urls;
  if (!urls || typeof urls !== "object") {
    return { lowRes: null, highRes: null, radUrl: null };
  }
  return {
    lowRes: pickSpzUrl(urls, ["150k", "100k"]),
    highRes: pickSpzUrl(urls, ["full_res", "3m", "500k"]),
    radUrl: pickSpzUrl(urls, ["rad"]),
  };
}

export async function forwardWorldlabsListWorlds(args: {
  credentialId: string;
  body: WorldlabsListWorldsRequest;
  baseUrlOverride?: string | null;
}): Promise<{
  status: number;
  worlds: WorldlabsWorld[];
  nextPageToken: string | null;
  vendorJson: unknown;
}> {
  const cred = await getDecryptedCredentialApiKey(args.credentialId);
  if (!cred) throw new Error("World Labs 凭证不可用");

  const root = resolveWorldlabsApiRoot(args.baseUrlOverride || cred.baseUrl);
  const url = `${root}/marble/v1/worlds:list`;
  const r = await fetch(url, {
    method: "POST",
    headers: worldlabsAuthHeaders(cred.apiKey),
    body: JSON.stringify(args.body),
  });
  const vendorJson = await readWorldlabsJson(r);
  if (!r.ok) {
    const detail =
      vendorJson &&
      typeof vendorJson === "object" &&
      "detail" in vendorJson &&
      typeof (vendorJson as { detail?: unknown }).detail === "string"
        ? String((vendorJson as { detail: string }).detail)
        : `World Labs HTTP ${r.status}`;
    throw new Error(detail);
  }
  const payload = vendorJson as { worlds?: WorldlabsWorld[]; next_page_token?: string | null };
  return {
    status: r.status,
    worlds: payload.worlds ?? [],
    nextPageToken: payload.next_page_token ?? null,
    vendorJson,
  };
}

/** Extract generated world from a completed operation response. */
export function extractWorldFromOperation(op: WorldlabsOperation): WorldlabsWorld | null {
  if (!op.done || op.error) return null;
  const resp = op.response;
  if (!resp || typeof resp !== "object") return null;
  const root = resp as Record<string, unknown>;
  if (root.world && typeof root.world === "object") {
    return root.world as WorldlabsWorld;
  }
  if (typeof root.world_id === "string") {
    return root as unknown as WorldlabsWorld;
  }
  return null;
}

export function extractWorldThumbnailUrl(world: WorldlabsWorld): string | null {
  const thumb = world.assets?.thumbnail_url?.trim();
  if (thumb) return thumb;
  const pano = world.assets?.imagery?.pano_url?.trim();
  return pano || null;
}

export { operationErrorMessage };
