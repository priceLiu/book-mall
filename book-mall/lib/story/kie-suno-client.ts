/**
 * KIE Suno API（/api/v1/generate · 非 Market createTask）
 * @see https://docs.kie.ai/suno-api/quickstart
 */
import { KieError } from "@/lib/story/kie-client";

export type KieSunoGenerateInput = {
  prompt: string;
  customMode?: boolean;
  instrumental?: boolean;
  model?: string;
  style?: string;
  title?: string;
  callBackUrl?: string | null;
};

function getBase(baseUrl?: string): string {
  return (baseUrl?.trim() || process.env.KIE_API_BASE?.trim() || "https://api.kie.ai").replace(
    /\/$/,
    "",
  );
}

export async function createKieSunoTaskWithKey(
  apiKey: string,
  args: KieSunoGenerateInput,
  baseUrl?: string,
): Promise<{ taskId: string }> {
  const { gatewayFetch } = await import("@/lib/gateway/format-fetch-error");
  const base = getBase(baseUrl);
  const url = `${base}/api/v1/generate`;
  const body: Record<string, unknown> = {
    prompt: args.prompt,
    customMode: args.customMode ?? false,
    instrumental: args.instrumental ?? false,
    model: args.model?.trim() || "V5",
  };
  if (args.style?.trim()) body.style = args.style.trim();
  if (args.title?.trim()) body.title = args.title.trim();
  if (args.callBackUrl) body.callBackUrl = args.callBackUrl;

  const r = await gatewayFetch(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    { hop: "upstream", providerKind: "KIE" },
  );
  const text = await r.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!r.ok) {
    throw new KieError(
      "KIE_HTTP_ERROR",
      `suno generate HTTP ${r.status}: ${text.slice(0, 400)}`,
      r.status >= 400 && r.status < 600 ? r.status : 502,
    );
  }
  const code = (json as { code?: number })?.code;
  if (code !== 200) {
    const msg = String((json as { msg?: string })?.msg ?? text);
    throw new KieError(
      "KIE_HTTP_ERROR",
      `suno generate code=${code} msg=${msg}`,
      typeof code === "number" && code >= 400 && code < 600 ? code : 502,
    );
  }
  const taskId =
    (json as { data?: { taskId?: string } })?.data?.taskId ??
    (json as { data?: { task_id?: string } })?.data?.task_id;
  if (!taskId || typeof taskId !== "string") {
    throw new KieError(
      "KIE_INVALID_RESPONSE",
      `suno generate missing taskId: ${text.slice(0, 200)}`,
      502,
      false,
    );
  }
  return { taskId };
}

export type KieSunoRecordResponse = {
  taskId: string;
  status: string;
  resultJson?: string | null;
  failCode?: string | null;
  failMsg?: string | null;
};

export async function getKieSunoTaskWithKey(
  apiKey: string,
  taskId: string,
  baseUrl?: string,
): Promise<KieSunoRecordResponse> {
  const base = getBase(baseUrl);
  const url = `${base}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`;
  const r = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const text = await r.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!r.ok) {
    throw new KieError(
      "KIE_HTTP_ERROR",
      `suno recordInfo HTTP ${r.status}: ${text.slice(0, 400)}`,
      502,
    );
  }
  const code = (json as { code?: number })?.code;
  if (code !== 200) {
    const msg = String((json as { msg?: string })?.msg ?? text);
    throw new KieError("KIE_HTTP_ERROR", `suno recordInfo code=${code} msg=${msg}`, 502);
  }
  const data = (json as { data?: KieSunoRecordResponse }).data;
  if (!data?.taskId) {
    throw new KieError("KIE_INVALID_RESPONSE", "suno recordInfo missing data", 502, false);
  }
  return data;
}

/** 从 Suno resultJson 提取首个音频 URL */
export function extractKieSunoResultUrl(record: KieSunoRecordResponse): string | null {
  if (!record.resultJson) return null;
  try {
    const parsed = JSON.parse(record.resultJson) as Record<string, unknown>;
    const urls = parsed.resultUrls ?? parsed.audioUrls ?? parsed.urls;
    if (Array.isArray(urls) && typeof urls[0] === "string") return urls[0];
    if (typeof parsed.audioUrl === "string") return parsed.audioUrl;
    if (typeof parsed.url === "string") return parsed.url;
  } catch {
    return null;
  }
  return null;
}
