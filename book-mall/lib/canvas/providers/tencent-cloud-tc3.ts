/**
 * 腾讯云 API 3.0 · TC3-HMAC-SHA256 签名（混元生3D 极速版等）
 * @see https://cloud.tencent.com/document/api/1804/120832
 */

import crypto from "node:crypto";

import { CanvasGatewayError } from "./types";

const TC3_ALGORITHM = "TC3-HMAC-SHA256";
const AI3D_HOST = "ai3d.tencentcloudapi.com";
const AI3D_SERVICE = "ai3d";
const AI3D_VERSION = "2025-05-13";

export type TencentCloudTc3Credentials = {
  secretId: string;
  secretKey: string;
  region: string;
};

function sha256Hex(message: string): string {
  return crypto.createHash("sha256").update(message, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, message: string): Buffer {
  return crypto.createHmac("sha256", key).update(message, "utf8").digest();
}

/** 解析 Provider apiKey：JSON `{t:"tc3",id,key,region}` 或 `AKID...:SecretKey` */
export function parseTencentCloudTc3Credentials(
  apiKey: string,
): TencentCloudTc3Credentials | null {
  const raw = apiKey.trim();
  if (!raw) return null;

  if (raw.startsWith("{")) {
    try {
      const o = JSON.parse(raw) as {
        t?: string;
        id?: string;
        key?: string;
        region?: string;
        secretId?: string;
        secretKey?: string;
      };
      const secretId = (o.id ?? o.secretId)?.trim();
      const secretKey = (o.key ?? o.secretKey)?.trim();
      if (secretId && secretKey) {
        return {
          secretId,
          secretKey,
          region: o.region?.trim() || "ap-guangzhou",
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (raw.startsWith("AKID") && raw.includes(":")) {
    const idx = raw.indexOf(":");
    const secretId = raw.slice(0, idx).trim();
    const secretKey = raw.slice(idx + 1).trim();
    if (secretId && secretKey) {
      return { secretId, secretKey, region: "ap-guangzhou" };
    }
  }

  return null;
}

export function resolveAi3dTc3Credentials(
  apiKey: string,
): TencentCloudTc3Credentials | null {
  const parsed = parseTencentCloudTc3Credentials(apiKey);
  if (parsed) return parsed;

  const secretId = process.env.HUNYUAN_TC_SECRET_ID?.trim();
  const secretKey = process.env.HUNYUAN_TC_SECRET_KEY?.trim();
  if (secretId && secretKey) {
    return {
      secretId,
      secretKey,
      region: process.env.HUNYUAN_TC_REGION?.trim() || "ap-guangzhou",
    };
  }
  return null;
}

type Ai3dTc3Response<T> = {
  Response?: T & { Error?: { Code?: string; Message?: string } };
};

function unwrapAi3dResponse<T>(parsed: Ai3dTc3Response<T>): T {
  if (parsed.Response && typeof parsed.Response === "object") {
    const err = parsed.Response.Error;
    if (err?.Code) {
      const quota = err.Code === "ResourceInsufficient";
      throw new CanvasGatewayError(
        quota ? "PROVIDER_QUOTA_EXCEEDED" : "PROVIDER_HTTP_ERROR",
        quota
          ? "混元生3D 资源不足：并发任务已满或账户积分/配额用尽。请稍后再试，或登录腾讯云混元控制台查看进行中的任务与余额。"
          : `混元生3D ${err.Code}: ${err.Message ?? ""}`.trim(),
        502,
        quota,
      );
    }
    return parsed.Response;
  }
  return parsed as T;
}

export async function callAi3dTencentCloudApi<T>(
  creds: TencentCloudTc3Credentials,
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payloadStr = JSON.stringify(payload);

  const canonicalRequest = [
    "POST",
    "/",
    "",
    `content-type:application/json\nhost:${AI3D_HOST}\n`,
    "content-type;host",
    sha256Hex(payloadStr),
  ].join("\n");

  const credentialScope = `${date}/${AI3D_SERVICE}/tc3_request`;
  const stringToSign = [
    TC3_ALGORITHM,
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const secretDate = hmacSha256(`TC3${creds.secretKey}`, date);
  const secretService = hmacSha256(secretDate, AI3D_SERVICE);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = hmacSha256(secretSigning, stringToSign).toString("hex");

  const authorization = `${TC3_ALGORITHM} Credential=${creds.secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;

  const r = await fetch(`https://${AI3D_HOST}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: AI3D_HOST,
      "X-TC-Action": action,
      "X-TC-Version": AI3D_VERSION,
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Region": creds.region,
      Authorization: authorization,
    },
    body: payloadStr,
  });

  const text = await r.text();
  if (!r.ok) {
    throw new CanvasGatewayError(
      r.status === 401 || r.status === 403
        ? "PROVIDER_AUTH_ERROR"
        : "PROVIDER_HTTP_ERROR",
      `混元极速版 HTTP ${r.status}: ${text.slice(0, 400)}`,
      r.status,
      r.status >= 500,
    );
  }

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new CanvasGatewayError(
      "PROVIDER_INVALID_RESPONSE",
      `混元极速版 非 JSON 响应: ${text.slice(0, 200)}`,
    );
  }

  return unwrapAi3dResponse(parsed as Ai3dTc3Response<T>);
}
