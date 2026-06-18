/**
 * Canvas · 私域虚拟/真人人像入库（经 Gateway VOLCENGINE 凭证）
 */

import { CanvasProjectError } from "./canvas-project-service";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import {
  pickSbv1VolcengineCredentialId,
  pickVolcengineCredentialForGatewayJob,
} from "@/lib/gateway/volcengine-credential-pick";
import {
  createRequestLog,
  finalizeRequestLog,
} from "@/lib/gateway/proxy-common";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  buildPortraitAssetUri,
  volcengineCreatePortraitAsset,
  volcengineGetPortraitAsset,
  volcenginePollPortraitAssetActive,
  volcengineResolveOrCreateAigcGroup,
  type VolcenginePortraitAssetRecord,
} from "@/lib/gateway/volcengine-portrait-actions";
import { resolveVolcenginePortraitCredentials } from "@/lib/gateway/volcengine-portrait-credentials";
import { getSbv1PortraitLivenessStatus } from "./sbv1-portrait-liveness-service";

export type CanvasPortraitKind = "virtual" | "real";

export type CanvasPortraitImportResult = {
  kind: CanvasPortraitKind;
  assetId: string;
  assetUri: string;
  status: "active" | "pending" | "failed";
  groupId?: string;
  message?: string;
};

function isHttpsUrl(u: string): boolean {
  return /^https:\/\//.test(u.trim());
}

async function volcengineCredentialForUser(
  userId: string,
  clientPage: string,
): Promise<{
  gatewayUserId: string;
  apiKeyId: string;
  credentialId: string;
  apiKey: string;
  baseUrl: string | null;
}> {
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "请先在 Book 个人中心关联 Gateway API Key",
      403,
    );
  }
  const sbv1 = clientPage.includes("/sbv1");
  const credentialId = sbv1
    ? pickSbv1VolcengineCredentialId(auth.credentials)
    : pickVolcengineCredentialForGatewayJob({
        credentials: auth.credentials,
        modelKey: "doubao-seedance-2.0",
        clientPage,
        input: null,
        providerId: null,
      });
  if (!credentialId) {
    throw new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "Gateway Key 未绑定火山方舟（VOLCENGINE）凭证",
      403,
    );
  }
  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred?.apiKey) {
    throw new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "火山方舟凭证不可用",
      503,
    );
  }
  return {
    gatewayUserId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl ?? null,
  };
}

function mapAssetToResult(
  kind: CanvasPortraitKind,
  asset: VolcenginePortraitAssetRecord,
  groupId?: string,
): CanvasPortraitImportResult {
  const status =
    asset.status === "Active"
      ? "active"
      : asset.status === "Failed"
        ? "failed"
        : "pending";
  return {
    kind,
    assetId: asset.id,
    assetUri: buildPortraitAssetUri(asset.id),
    status,
    groupId: groupId ?? asset.groupId,
    message:
      status === "failed"
        ? "火山侧素材处理失败"
        : status === "pending"
          ? "素材处理中"
          : undefined,
  };
}

export async function importCanvasPortraitAsset(opts: {
  userId: string;
  kind: CanvasPortraitKind;
  imageUrl: string;
  name?: string;
  projectId?: string;
  edition?: "sbv1" | "pro2";
  pollUntilActive?: boolean;
}): Promise<CanvasPortraitImportResult> {
  const imageUrl = opts.imageUrl.trim();
  if (!isHttpsUrl(imageUrl)) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "入库图片须为公网 HTTPS URL（请先上传至 OSS）",
    );
  }

  const edition = opts.edition ?? "sbv1";
  const clientPage =
    edition === "pro2"
      ? `canvas/${opts.projectId ?? "unknown"}/story-pro2`
      : `canvas/${opts.projectId ?? "unknown"}/sbv1`;

  const { gatewayUserId, apiKeyId, credentialId, apiKey } =
    await volcengineCredentialForUser(opts.userId, clientPage);
  const portraitCredentials = resolveVolcenginePortraitCredentials(apiKey);

  let groupId: string;
  if (opts.kind === "real") {
    const liveness = await getSbv1PortraitLivenessStatus(opts.userId);
    if (!liveness.verified || !liveness.groupId) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        "真人人像入库须先完成 H5 活体认证",
        400,
      );
    }
    groupId = liveness.groupId;
  } else {
    groupId = await volcengineResolveOrCreateAigcGroup({
      credentials: portraitCredentials,
      preferredName: "Canvas虚拟人像",
    });
  }

  const log = await createRequestLog({
    userId: gatewayUserId,
    actorBookUserId: opts.userId,
    apiKeyId,
    credentialId,
    clientPage,
    model: `portrait:${opts.kind}`,
    endpoint: `/canvas/portrait/${opts.kind}/import`,
    providerKind: "VOLCENGINE",
    requestKind: "OTHER",
    clientSource: edition === "pro2" ? "CANVAS" : "CANVAS",
    inputSummary: buildGatewayInputSummary(`portrait:${opts.kind}`, {
      kind: opts.kind,
      edition,
      groupId,
      referenceImageUrls: [imageUrl],
    }),
  });

  const started = Date.now();
  try {
    const created = await volcengineCreatePortraitAsset({
      credentials: portraitCredentials,
      groupId,
      url: imageUrl,
      assetType: "Image",
      name: opts.name?.trim() || "canvas-portrait",
    });

    let finalAsset = created;
    if (opts.pollUntilActive !== false && created.status !== "Active") {
      finalAsset = await volcenginePollPortraitAssetActive({
        credentials: portraitCredentials,
        assetId: created.id,
      });
    }

    const result = mapAssetToResult(opts.kind, finalAsset, groupId);
    await finalizeRequestLog(log.id, {
      status: result.status === "failed" ? "FAILED" : "SUCCEEDED",
      durationMs: Date.now() - started,
      failMessage: result.message,
      resultSummary: {
        assetId: result.assetId,
        assetUri: result.assetUri,
        status: result.status,
      },
    });
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: msg.slice(0, 500),
    });
    throw e instanceof CanvasProjectError
      ? e
      : new CanvasProjectError("UPSTREAM_ERROR", msg, 502);
  }
}

export async function getCanvasPortraitImportStatus(opts: {
  userId: string;
  assetId: string;
  edition?: "sbv1" | "pro2";
  projectId?: string;
  kind?: CanvasPortraitKind;
}): Promise<CanvasPortraitImportResult> {
  const assetId = opts.assetId.trim();
  if (!assetId) {
    throw new CanvasProjectError("INVALID_INPUT", "缺少 assetId");
  }
  const edition = opts.edition ?? "sbv1";
  const clientPage =
    edition === "pro2"
      ? `canvas/${opts.projectId ?? "unknown"}/story-pro2`
      : `canvas/${opts.projectId ?? "unknown"}/sbv1`;
  const { apiKey } = await volcengineCredentialForUser(
    opts.userId,
    clientPage,
  );
  const portraitCredentials = resolveVolcenginePortraitCredentials(apiKey);
  const asset = await volcengineGetPortraitAsset({
    credentials: portraitCredentials,
    assetId,
  });
  return mapAssetToResult(opts.kind ?? "virtual", asset);
}

/** 解析 run 请求中的 portraitAssetRefs（客户端传入） */
export function normalizePortraitAssetRefs(
  raw: unknown,
): Array<{ url: string; role?: "reference_image" | "first_frame" | "last_frame" }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    url: string;
    role?: "reference_image" | "first_frame" | "last_frame";
  }> = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item === "string") {
      const url = item.trim();
      if (!url.startsWith("asset://") || seen.has(url)) continue;
      seen.add(url);
      out.push({ url, role: "reference_image" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = String(row.url ?? row.assetUri ?? "").trim();
    if (!url.startsWith("asset://") || seen.has(url)) continue;
    seen.add(url);
    const role = row.role;
    out.push({
      url,
      role:
        role === "first_frame" || role === "reference_image" || role === "last_frame"
          ? role
          : "reference_image",
    });
  }
  return out;
}
