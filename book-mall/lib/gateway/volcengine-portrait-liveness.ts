/**
 * 火山方舟 · 真人人像库 · H5 活体认证（LivenessFace · AK/SK）
 * 文档：https://www.volcengine.com/docs/82379/2333589
 */

import type { VolcenginePortraitCredentials } from "./volcengine-portrait-credentials";
import { postVolcenginePortraitOpenAction } from "./volcengine-portrait-open-api";

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
      "火山 IAM Access Key 无效或无 portrait 权限。" +
      "请检查 VOLCENGINE_ACCESS_KEY / VOLCENGINE_SECRET_ACCESS_KEY。"
    );
  }

  if (opts.status === 404 && !trimmed) {
    return (
      "当前火山账号未开通「真人人像库」接口。" +
      `请先在 ${PORTRAIT_CONSOLE_HINT} 开通并完成认证，再重试。` +
      ` 指南：${PORTRAIT_GUIDE_URL}`
    );
  }

  if (trimmed) {
    return `${opts.action} ${opts.status}: ${trimmed.slice(0, 400)}`;
  }

  return `${opts.action} ${opts.status}: ${opts.url}`;
}

export async function createVolcengineVisualValidateSession(opts: {
  credentials: VolcenginePortraitCredentials;
  callbackUrl: string;
}): Promise<VolcenginePortraitLivenessSession> {
  const { status, text, json, url } = await postVolcenginePortraitOpenAction({
    credentials: opts.credentials,
    action: "CreateVisualValidateSession",
    body: {
      CallbackURL: opts.callbackUrl,
      ProjectName: "default",
    },
  });
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
  credentials: VolcenginePortraitCredentials;
  bytedToken: string;
}): Promise<VolcenginePortraitLivenessResult> {
  const { status, text, json, url } = await postVolcenginePortraitOpenAction({
    credentials: opts.credentials,
    action: "GetVisualValidateResult",
    body: {
      BytedToken: opts.bytedToken.trim(),
      ProjectName: "default",
    },
  });

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
        url,
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
        url,
      }),
      raw: json,
    };
  }

  const result = pickResultObject(json);
  const groupId = String(
    result?.GroupId ?? result?.groupId ?? result?.AssetGroupId ?? result?.Id ?? "",
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
