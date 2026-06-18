/**
 * 火山引擎 OpenAPI · HMAC-SHA256 签名（Assets / Portrait 等管控面）
 * 参考：https://docs.agentsflare.com/api-examples/assets-api · volc-openapi-demos
 */

import { createHash, createHmac } from "crypto";

const DEFAULT_HOST = "open.volcengineapi.com";
const DEFAULT_REGION = "cn-beijing";
const DEFAULT_SERVICE = "ark";

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function formatUtcTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSha256(secretAccessKey, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "request");
}

export function resolveVolcengineOpenApiHost(): string {
  return (
    process.env.VOLCENGINE_OPENAPI_HOST?.trim() ||
    process.env.VOLCENGINE_PORTRAIT_OPENAPI_HOST?.trim() ||
    DEFAULT_HOST
  );
}

export function signVolcengineOpenApiRequest(opts: {
  method: string;
  path: string;
  query?: Record<string, string>;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  host?: string;
  region?: string;
  service?: string;
}): Record<string, string> {
  const host = opts.host ?? resolveVolcengineOpenApiHost();
  const region = opts.region ?? DEFAULT_REGION;
  const service = opts.service ?? DEFAULT_SERVICE;
  const method = opts.method.toUpperCase();
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const queryString = opts.query
    ? new URLSearchParams(opts.query).toString().replace(/\+/g, "%20")
    : "";

  const xDate = formatUtcTimestamp(new Date());
  const dateStamp = xDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/request`;
  const bodyHash = sha256Hex(opts.body);
  const signedHeaders = "host;x-date";
  const canonicalHeaders = `host:${host}\nx-date:${xDate}\n`;
  const canonicalRequest = [
    method,
    path,
    queryString,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");
  const stringToSign = [
    "HMAC-SHA256",
    xDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = getSigningKey(opts.secretAccessKey, dateStamp, region, service);
  const signature = hmacSha256(signingKey, stringToSign).toString("hex");
  const authorization = [
    `HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  return {
    Host: host,
    "Content-Type": "application/json",
    "X-Date": xDate,
    Authorization: authorization,
  };
}
