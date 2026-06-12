/**
 * 火山方舟 · 真人人像库 · H5 活体认证（LivenessFace）
 * 文档：https://www.volcengine.com/docs/82379/2333589
 * Action API：CreateVisualValidateSession / GetVisualValidateResult
 */

import { resolveVolcengineArkApiRoot } from "@/lib/gateway/model-router";

const PORTRAIT_ACTION_VERSION = "2024-01-01";

function portraitActionCandidates(
  baseUrl: string | null | undefined,
  action: "CreateVisualValidateSession" | "GetVisualValidateResult",
): string[] {
  const custom = process.env.VOLCENGINE_PORTRAIT_ACTION_BASE?.trim();
  if (custom) {
    const sep = custom.includes("?") ? "&" : "?";
    return [`${custom}${sep}Action=${action}&Version=${PORTRAIT_ACTION_VERSION}`];
  }
  const root = resolveVolcengineArkApiRoot(baseUrl);
  const qs = `Action=${action}&Version=${PORTRAIT_ACTION_VERSION}`;
  return [
    `${root}/portrait?${qs}`,
    `${root}/portrait/?${qs}`,
  ];
}

async function postPortraitAction(
  apiKey: string,
  baseUrl: string | null | undefined,
  action: "CreateVisualValidateSession" | "GetVisualValidateResult",
  body: Record<string, unknown>,
): Promise<{ status: number; text: string; json: unknown; url: string }> {
  const urls = portraitActionCandidates(baseUrl, action);
  let last: { status: number; text: string; json: unknown; url: string } = {
    status: 0,
    text: "",
    json: null,
    url: urls[0] ?? "",
  };
  for (const url of urls) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let json: unknown = text;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    last = { status: r.status, text, json, url };
    if (r.status !== 404) return last;
  }
  return last;
}

export type VolcenginePortraitLivenessSession = {
  bytedToken: string;
  h5Link: string;
  callbackUrl: string;
  raw: unknown;
};

export type VolcenginePortraitLivenessResult = {
  status: "pending" | "succeeded" | "failed";
  groupId?: string;
  message?: string;
  raw: unknown;
};

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

function pickErrorCode(json: unknown): string | undefined {
  return pickResponseMetadataError(json)?.code;
}

const PORTRAIT_GUIDE_URL =
  "https://www.volcengine.com/docs/82379/2333589?lang=zh";
const PORTRAIT_CONSOLE_HINT =
  "火山方舟控制台 → 体验中心 → 我的 → 真人人像（须完成实名/企业认证）";

/** 将 HTTP/上游错误转为面向用户的说明（避免裸 404 + URL） */
export function formatVolcenginePortraitLivenessError(opts: {
  action: "CreateVisualValidateSession" | "GetVisualValidateResult";
  status: number;
  text: string;
  json: unknown;
  url: string;
}): string {
  const metaErr = pickResponseMetadataError(opts.json);
  if (metaErr?.code || metaErr?.message) {
    const detail = [metaErr.code, metaErr.message].filter(Boolean).join(": ");
    if (metaErr.code === "ValidatePending") {
      return "H5 活体认证尚未完成，请稍候再试。";
    }
    if (metaErr.code === "AIGCNotAvailable" || metaErr.code === "QuotaExceeded") {
      return `${detail}。请检查火山账号人像库配额与开通状态。`;
    }
    return `${opts.action} 失败：${detail}`;
  }

  const trimmed = opts.text.trim();
  if (opts.status === 401 || opts.status === 403) {
    return (
      "火山方舟 API Key 无效或无权限。请在 Book 个人中心检查 Gateway 绑定的 VOLCENGINE 凭证，" +
      "并在火山控制台重新创建 API Key。"
    );
  }

  if (opts.status === 404 && !trimmed) {
    return (
      "当前火山方舟账号或 API Key 未开通「真人人像库」Portrait 接口（上游返回 404）。" +
      `请先在 ${PORTRAIT_CONSOLE_HINT} 开通并完成认证，再重试。` +
      ` 指南：${PORTRAIT_GUIDE_URL}` +
      "。若已开通仍失败，请确认 Gateway 凭证 baseUrl 为 https://ark.cn-beijing.volces.com/api/v3" +
      "（勿带 /chat/completions），或设置环境变量 VOLCENGINE_PORTRAIT_ACTION_BASE。"
    );
  }

  if (trimmed) {
    return `${opts.action} ${opts.status}: ${trimmed.slice(0, 400)}`;
  }

  return `${opts.action} ${opts.status}: ${opts.url}`;
}

export async function createVolcengineVisualValidateSession(opts: {
  apiKey: string;
  baseUrl?: string | null;
  callbackUrl: string;
}): Promise<VolcenginePortraitLivenessSession> {
  const { status, text, json, url } = await postPortraitAction(
    opts.apiKey,
    opts.baseUrl,
    "CreateVisualValidateSession",
    {
      CallbackURL: opts.callbackUrl,
      ProjectName: "default",
    },
  );
  if (status !== 200 && status !== 201) {
    throw new Error(
      formatVolcenginePortraitLivenessError({
        action: "CreateVisualValidateSession",
        status,
        text,
        json,
        url,
      }),
    );
  }
  const result = pickResultObject(json);
  const bytedToken = String(
    result?.BytedToken ?? result?.bytedToken ?? "",
  ).trim();
  const h5Link = String(result?.H5Link ?? result?.h5Link ?? "").trim();
  const callbackUrl = String(
    result?.CallbackURL ?? result?.callbackUrl ?? opts.callbackUrl,
  ).trim();
  if (!bytedToken || !h5Link) {
    throw new Error(
      `CreateVisualValidateSession 响应缺少 BytedToken/H5Link: ${text.slice(0, 400)}`,
    );
  }
  return { bytedToken, h5Link, callbackUrl, raw: json };
}

export async function getVolcengineVisualValidateResult(opts: {
  apiKey: string;
  baseUrl?: string | null;
  bytedToken: string;
}): Promise<VolcenginePortraitLivenessResult> {
  const { status, text, json } = await postPortraitAction(
    opts.apiKey,
    opts.baseUrl,
    "GetVisualValidateResult",
    {
      BytedToken: opts.bytedToken.trim(),
      ProjectName: "default",
    },
  );

  const errCode = pickErrorCode(json);
  if (errCode === "ValidatePending") {
    return { status: "pending", raw: json };
  }

  if (!status || status === 404) {
    return {
      status: "failed",
      message: formatVolcenginePortraitLivenessError({
        action: "GetVisualValidateResult",
        status: status || 404,
        text,
        json,
        url: "",
      }),
      raw: json,
    };
  }

  if (status !== 200 && status !== 201) {
    return {
      status: "failed",
      message: formatVolcenginePortraitLivenessError({
        action: "GetVisualValidateResult",
        status,
        text,
        json,
        url: "",
      }),
      raw: json,
    };
  }

  const result = pickResultObject(json);
  const groupId = String(
    result?.GroupId ?? result?.groupId ?? result?.AssetGroupId ?? "",
  ).trim();
  if (groupId) {
    return { status: "succeeded", groupId, raw: json };
  }

  return {
    status: "pending",
    message: "等待 H5 活体认证完成",
    raw: json,
  };
}
