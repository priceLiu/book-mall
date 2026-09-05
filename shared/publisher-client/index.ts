/** 一键发布 · 客户端 SDK（扩展 / 桌面 / 网页共用） */

export type ClientDeviceType = "WEB" | "EXTENSION" | "DESKTOP";

export type ClientAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  deviceId: string;
  userId: string;
};

export type PublisherPlatform =
  | "xiaohongshu"
  | "douyin"
  | "weibo"
  | "bilibili"
  | "wechat_mp";

export const PUBLISHER_PLATFORMS: PublisherPlatform[] = [
  "xiaohongshu",
  "douyin",
  "weibo",
  "bilibili",
  "wechat_mp",
];

export const PLATFORM_LABELS: Record<PublisherPlatform, string> = {
  xiaohongshu: "小红书",
  douyin: "抖音",
  weibo: "微博",
  bilibili: "B站",
  wechat_mp: "微信公众号",
};

/** 受信网页 origin 白名单（扩展 postMessage 校验） */
export const TRUSTED_PUBLISHER_ORIGINS = [
  "http://localhost:3011",
  "http://localhost:3007",
  "https://publish.ai-code8.com",
  "https://ecom.ai-code8.com",
] as const;

export function isTrustedPublisherOrigin(origin: string): boolean {
  const o = origin.replace(/\/$/, "");
  return (TRUSTED_PUBLISHER_ORIGINS as readonly string[]).some(
    (t) => t.replace(/\/$/, "") === o,
  );
}

export type PublisherJobTicketPayload = {
  jobId: string;
  userId: string;
  platforms: PublisherPlatform[];
  exp: number;
};

export type PublisherJobResponse = {
  ok: boolean;
  jobId: string;
  jobTicket: string;
  userId: string;
  platforms: PublisherPlatform[];
  expiresIn: number;
};

export type SyncPublishPayload = {
  title?: string;
  content: string;
  images?: string[];
  videoUrl?: string;
  tags?: string[];
};

export async function refreshClientTokens(
  bookOrigin: string,
  refreshToken: string,
): Promise<ClientAuthTokens> {
  const res = await fetch(`${bookOrigin.replace(/\/$/, "")}/api/sso/client/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "续签失败");
  }
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresIn: Number(data.expires_in),
    deviceId: String(data.device_id),
    userId: String(data.user_id),
  };
}

export async function createPublisherJob(
  fetchFn: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>,
  platforms: PublisherPlatform[],
): Promise<PublisherJobResponse> {
  const data = await fetchFn("sso/tools/publisher/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platforms }),
  });
  return data as unknown as PublisherJobResponse;
}

/** 网页 → 扩展派发发布任务 */
export function dispatchPublishToExtension(input: {
  jobTicket: string;
  userId: string;
  payload: SyncPublishPayload;
  platforms: PublisherPlatform[];
}): void {
  window.postMessage(
    {
      type: "PUBLISHER_EXTENSION_PUBLISH",
      jobTicket: input.jobTicket,
      userId: input.userId,
      payload: input.payload,
      platforms: input.platforms,
    },
    window.location.origin,
  );
}

/** 构建客户端登录 URL（扩展 / 桌面跳转网页） */
export function buildClientLoginUrl(
  publisherOrigin: string,
  client: "extension" | "desktop",
  redirectPath = "/auth/client-callback",
  loopback?: string,
): string {
  const base = publisherOrigin.replace(/\/$/, "");
  const params = new URLSearchParams({
    client,
    redirect: redirectPath,
  });
  if (loopback) params.set("loopback", loopback);
  return `${base}/login?${params.toString()}`;
}
