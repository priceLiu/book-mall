/**
 * 火山方舟 · 私域虚拟/真人人像库 · Open API（AK/SK）
 * 文档：https://www.volcengine.com/docs/82379/2333601 · Assets API open.volcengineapi.com/open/*
 */

import type { VolcenginePortraitCredentials } from "./volcengine-portrait-credentials";
import { postVolcenginePortraitOpenAction } from "./volcengine-portrait-open-api";

export type VolcenginePortraitActionName =
  | "CreateAssetGroup"
  | "GetAssetGroup"
  | "ListAssetGroups"
  | "CreateAsset"
  | "GetAsset"
  | "ListAssets"
  | "DeleteAsset";

export type VolcenginePortraitAssetStatus =
  | "Processing"
  | "Active"
  | "Failed"
  | "Unknown";

export type VolcenginePortraitAssetRecord = {
  id: string;
  groupId?: string;
  name?: string;
  assetType?: string;
  status: VolcenginePortraitAssetStatus;
  url?: string;
  raw: unknown;
};

/** 火山 CreateAsset / CreateAssetGroup · Name 上限（InvalidParameter.Name） */
export const VOLCENGINE_PORTRAIT_NAME_MAX_LEN = 64;

/** 截断至火山 Name 上限；空串回退 fallback。 */
export function sanitizeVolcenginePortraitName(
  name: string | null | undefined,
  fallback = "canvas-portrait",
): string {
  const trimmed = String(name ?? "").trim();
  const base = trimmed || fallback.trim() || "canvas-portrait";
  const chars = [...base];
  if (chars.length <= VOLCENGINE_PORTRAIT_NAME_MAX_LEN) return base;
  return chars.slice(0, VOLCENGINE_PORTRAIT_NAME_MAX_LEN).join("");
}

function pickResultObject(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const result = root.Result ?? root.result;
  if (result && typeof result === "object") {
    return result as Record<string, unknown>;
  }
  return root;
}

function pickResponseMetadataError(
  json: unknown,
): { code?: string; message?: string } | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const meta = root.ResponseMetadata;
  if (!meta || typeof meta !== "object") return null;
  const err = (meta as Record<string, unknown>).Error;
  if (!err || typeof err !== "object") return null;
  const row = err as Record<string, unknown>;
  return {
    code: typeof row.Code === "string" ? row.Code : undefined,
    message: typeof row.Message === "string" ? row.Message : undefined,
  };
}

export function formatVolcenginePortraitActionError(opts: {
  action: VolcenginePortraitActionName;
  status: number;
  text: string;
  json: unknown;
}): string {
  const metaErr = pickResponseMetadataError(opts.json);
  if (metaErr?.code || metaErr?.message) {
    const detail = [metaErr.code, metaErr.message].filter(Boolean).join(": ");
    if (metaErr.code === "QuotaExceeded") {
      return `${detail}。请检查火山账号人像库配额。`;
    }
    return `${opts.action} 失败：${detail}`;
  }
  const trimmed = opts.text.trim();
  if (opts.status === 401 || opts.status === 403) {
    return (
      "火山 IAM Access Key 无效或无 portrait 权限。" +
      "请在 Gateway 火山凭证中检查 Access Key / Secret Access Key 及素材库权限。"
    );
  }
  if (opts.status === 404 && !trimmed) {
    return (
      "当前火山账号未开通私域人像库 Assets API。" +
      "请在火山方舟体验中心开通虚拟/真人人像库后重试。"
    );
  }
  if (trimmed) return `${opts.action} ${opts.status}: ${trimmed.slice(0, 400)}`;
  return `${opts.action} ${opts.status}`;
}

async function postPortraitAction(
  credentials: VolcenginePortraitCredentials,
  action: VolcenginePortraitActionName,
  body: Record<string, unknown>,
): Promise<{ status: number; text: string; json: unknown }> {
  const { status, text, json } = await postVolcenginePortraitOpenAction({
    credentials,
    action,
    body,
  });
  return { status, text, json };
}

function assertPortraitActionOk(
  action: VolcenginePortraitActionName,
  status: number,
  text: string,
  json: unknown,
): void {
  const metaErr = pickResponseMetadataError(json);
  if (metaErr?.code) {
    throw new Error(formatVolcenginePortraitActionError({ action, status, text, json }));
  }
  if (status !== 200 && status !== 201) {
    throw new Error(formatVolcenginePortraitActionError({ action, status, text, json }));
  }
}

function normalizeAssetStatus(raw: unknown): VolcenginePortraitAssetStatus {
  const s = String(raw ?? "").trim();
  if (s === "Active" || s === "Processing" || s === "Failed") return s;
  return "Unknown";
}

function parseAssetRecord(json: unknown): VolcenginePortraitAssetRecord | null {
  const result = pickResultObject(json);
  if (!result) return null;
  const asset = (result.Asset ?? result.asset ?? result) as Record<
    string,
    unknown
  >;
  if (!asset || typeof asset !== "object") return null;
  const id = String(asset.Id ?? asset.id ?? asset.AssetId ?? "").trim();
  if (!id) return null;
  const status = normalizeAssetStatus(
    asset.UpstreamStatus ?? asset.Status ?? asset.status,
  );
  return {
    id,
    groupId: String(asset.GroupId ?? asset.groupId ?? "").trim() || undefined,
    name: String(asset.Name ?? asset.name ?? "").trim() || undefined,
    assetType:
      String(asset.AssetType ?? asset.assetType ?? "").trim() || undefined,
    status,
    url: String(asset.URL ?? asset.url ?? "").trim() || undefined,
    raw: json,
  };
}

export function buildPortraitAssetUri(assetId: string): string {
  const id = assetId.trim();
  if (!id) return "";
  return id.startsWith("asset://") ? id : `asset://${id}`;
}

export async function volcengineCreateAigcAssetGroup(opts: {
  credentials: VolcenginePortraitCredentials;
  name: string;
  description?: string;
}): Promise<{ groupId: string; raw: unknown }> {
  const { status, text, json } = await postPortraitAction(
    opts.credentials,
    "CreateAssetGroup",
    {
      GroupType: "AIGC",
      Name: sanitizeVolcenginePortraitName(opts.name, "Canvas虚拟人像"),
      Description: opts.description?.trim() || undefined,
      ProjectName: "default",
    },
  );
  assertPortraitActionOk("CreateAssetGroup", status, text, json);
  const result = pickResultObject(json);
  const groupId = String(
    result?.Id ?? result?.GroupId ?? result?.groupId ?? "",
  ).trim();
  if (!groupId) {
    throw new Error(
      `CreateAssetGroup 响应缺少 Id: ${text.slice(0, 400)}`,
    );
  }
  return { groupId, raw: json };
}

export async function volcengineListAigcAssetGroups(opts: {
  credentials: VolcenginePortraitCredentials;
}): Promise<Array<{ groupId: string; name?: string }>> {
  const { status, text, json } = await postPortraitAction(
    opts.credentials,
    "ListAssetGroups",
    {
      Filter: { GroupType: "AIGC" },
      ProjectName: "default",
      PageSize: 50,
      PageNumber: 1,
    },
  );
  assertPortraitActionOk("ListAssetGroups", status, text, json);
  const result = pickResultObject(json);
  const items = (result?.Items ??
    result?.AssetGroups ??
    result?.Groups ??
    []) as unknown[];
  if (!Array.isArray(items)) return [];
  return items.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    const groupId = String(r.Id ?? r.GroupId ?? r.id ?? "").trim();
    if (!groupId) return [];
    const name = String(r.Name ?? r.name ?? "").trim();
    return [{ groupId, ...(name ? { name } : {}) }];
  });
}

export async function volcengineCreatePortraitAsset(opts: {
  credentials: VolcenginePortraitCredentials;
  groupId: string;
  url: string;
  assetType?: "Image" | "Video" | "Audio";
  name?: string;
}): Promise<VolcenginePortraitAssetRecord> {
  const { status, text, json } = await postPortraitAction(
    opts.credentials,
    "CreateAsset",
    {
      GroupId: opts.groupId.trim(),
      URL: opts.url.trim(),
      AssetType: opts.assetType ?? "Image",
      Name: sanitizeVolcenginePortraitName(opts.name, "canvas-portrait"),
      ProjectName: "default",
    },
  );
  assertPortraitActionOk("CreateAsset", status, text, json);
  const parsed = parseAssetRecord(json);
  if (!parsed) {
    throw new Error(`CreateAsset 响应缺少 Asset Id: ${text.slice(0, 400)}`);
  }
  return parsed;
}

export async function volcengineGetPortraitAsset(opts: {
  credentials: VolcenginePortraitCredentials;
  assetId: string;
}): Promise<VolcenginePortraitAssetRecord> {
  const { status, text, json } = await postPortraitAction(
    opts.credentials,
    "GetAsset",
    {
      Id: opts.assetId.trim(),
      ProjectName: "default",
    },
  );
  assertPortraitActionOk("GetAsset", status, text, json);
  const parsed = parseAssetRecord(json);
  if (!parsed) {
    throw new Error(`GetAsset 响应无效: ${text.slice(0, 400)}`);
  }
  return parsed;
}

export async function volcenginePollPortraitAssetActive(opts: {
  credentials: VolcenginePortraitCredentials;
  assetId: string;
  maxAttempts?: number;
  intervalMs?: number;
}): Promise<VolcenginePortraitAssetRecord> {
  const max = opts.maxAttempts ?? 40;
  const intervalMs = opts.intervalMs ?? 3000;
  for (let i = 0; i < max; i++) {
    const asset = await volcengineGetPortraitAsset({
      credentials: opts.credentials,
      assetId: opts.assetId,
    });
    if (asset.status === "Active") return asset;
    if (asset.status === "Failed") {
      throw new Error(`人像素材处理失败（AssetId=${asset.id}）`);
    }
    if (i < max - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error(
    `人像素材仍在处理中（AssetId=${opts.assetId}），请稍后查询状态`,
  );
}

export async function volcengineResolveOrCreateAigcGroup(opts: {
  credentials: VolcenginePortraitCredentials;
  preferredName?: string;
}): Promise<string> {
  const groups = await volcengineListAigcAssetGroups({
    credentials: opts.credentials,
  });
  const preferred = opts.preferredName?.trim();
  if (preferred) {
    const hit = groups.find((g) => g.name === preferred);
    if (hit) return hit.groupId;
  }
  if (groups[0]?.groupId) return groups[0].groupId;
  const created = await volcengineCreateAigcAssetGroup({
    credentials: opts.credentials,
    name: sanitizeVolcenginePortraitName(preferred, "Canvas虚拟人像"),
  });
  return created.groupId;
}
