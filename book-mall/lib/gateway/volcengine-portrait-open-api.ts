/**
 * 火山 OpenAPI · Action/Version 查询参数 + AK/SK 签名
 */

import {
  resolveVolcengineOpenApiHost,
  signVolcengineOpenApiRequest,
} from "./volcengine-open-api-sign";
import type { VolcenginePortraitCredentials } from "./volcengine-portrait-credentials";

const PORTRAIT_ACTION_VERSION = "2024-01-01";

export async function postVolcenginePortraitOpenAction(opts: {
  credentials: VolcenginePortraitCredentials;
  action: string;
  body: Record<string, unknown>;
}): Promise<{ status: number; text: string; json: unknown; url: string }> {
  const host = opts.credentials.host ?? resolveVolcengineOpenApiHost();
  const path = "/";
  const query = {
    Action: opts.action,
    Version: PORTRAIT_ACTION_VERSION,
  };
  const bodyText = JSON.stringify(opts.body);
  const headers = signVolcengineOpenApiRequest({
    method: "POST",
    path,
    query,
    body: bodyText,
    accessKeyId: opts.credentials.accessKeyId,
    secretAccessKey: opts.credentials.secretAccessKey,
    host,
  });
  const qs = new URLSearchParams(query).toString();
  const url = `https://${host}${path}?${qs}`;
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: bodyText,
  });
  const text = await r.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: r.status, text, json, url };
}
