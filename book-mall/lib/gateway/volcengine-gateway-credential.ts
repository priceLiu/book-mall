/**
 * Gateway · 火山方舟（VOLCENGINE）凭证解析
 *
 * 存储格式（加密写入 apiKeyEncrypted）：
 * - 仅 Seedance / 推理：`ark-...` 明文
 * - Seedance + 私域人像 IAM：`{"apiKey":"ark-...","accessKeyId":"AK...","secretAccessKey":"SK..."}`
 *
 * 人像库 / 活体 H5 须 IAM AK/SK；纯生视频可只配 ark API Key。
 */

export type VolcenginePortraitIam = {
  accessKeyId: string;
  secretAccessKey: string;
  host?: string;
};

export type ParsedVolcengineGatewayCredential = {
  /** ark- Bearer · chat / Seedance 2.0 视频 */
  arkApiKey: string;
  /** open.volcengineapi.com · 私域人像 Assets / 活体 */
  portraitIam?: VolcenginePortraitIam;
};

function readJsonField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** 从 Gateway 凭证解密串解析 ark Key 与可选 IAM */
export function parseVolcengineGatewayCredential(
  raw: string,
): ParsedVolcengineGatewayCredential {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { arkApiKey: "" };
  }

  if (trimmed.startsWith("{")) {
    try {
      const row = JSON.parse(trimmed) as Record<string, unknown>;
      const arkApiKey = readJsonField(row, [
        "apiKey",
        "api_key",
        "arkApiKey",
        "ark_api_key",
      ]);
      const accessKeyId = readJsonField(row, [
        "accessKeyId",
        "accessKey",
        "access_key_id",
        "ak",
      ]);
      const secretAccessKey = readJsonField(row, [
        "secretAccessKey",
        "secretKey",
        "secret_access_key",
        "sk",
      ]);
      const portraitIam =
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined;
      return { arkApiKey, portraitIam };
    } catch {
      /* fall through */
    }
  }

  const colon = trimmed.indexOf(":");
  if (colon > 0 && trimmed.startsWith("AK")) {
    return {
      arkApiKey: "",
      portraitIam: {
        accessKeyId: trimmed.slice(0, colon),
        secretAccessKey: trimmed.slice(colon + 1),
      },
    };
  }

  return { arkApiKey: trimmed };
}

/** 写入 Gateway 凭证字段（创建 / 更新） */
export function buildVolcengineCredentialStorage(opts: {
  apiKey?: string | null;
  accessKeyId?: string | null;
  secretAccessKey?: string | null;
  existingRaw?: string | null;
}): string {
  const existing = opts.existingRaw
    ? parseVolcengineGatewayCredential(opts.existingRaw)
    : null;

  const arkApiKey = opts.apiKey?.trim() || existing?.arkApiKey || "";
  const accessKeyId =
    opts.accessKeyId?.trim() || existing?.portraitIam?.accessKeyId || "";
  const secretAccessKey =
    opts.secretAccessKey?.trim() ||
    existing?.portraitIam?.secretAccessKey ||
    "";

  if (accessKeyId && !secretAccessKey) {
    throw new Error("请同时填写 Secret Access Key");
  }
  if (secretAccessKey && !accessKeyId) {
    throw new Error("请同时填写 Access Key ID");
  }

  if (accessKeyId && secretAccessKey) {
    if (arkApiKey) {
      return JSON.stringify({ apiKey: arkApiKey, accessKeyId, secretAccessKey });
    }
    return JSON.stringify({ accessKeyId, secretAccessKey });
  }

  if (!arkApiKey) {
    throw new Error("请填写火山 ARK API Key（ark-…）");
  }
  return arkApiKey;
}

export function resolveVolcengineArkApiKey(raw: string): string {
  const { arkApiKey } = parseVolcengineGatewayCredential(raw);
  if (!arkApiKey) {
    throw new Error(
      "火山凭证缺少 ARK API Key（请在 Gateway 火山凭证中配置 ark- Key，用于 Seedance 2.0 / 推理）",
    );
  }
  return arkApiKey;
}

/** 私域人像 / 活体 · 须 Gateway 凭证内 IAM AK/SK */
export function resolveVolcenginePortraitCredentials(
  gatewayCredentialRaw: string,
): VolcenginePortraitIam {
  const { portraitIam } = parseVolcengineGatewayCredential(gatewayCredentialRaw);
  if (portraitIam) return portraitIam;
  throw new Error(
    "私域人像库需在 Gateway 火山凭证中配置 IAM Access Key 与 Secret Access Key（可与 ark API Key 写在同一条凭证）",
  );
}

/** @deprecated 本地脚本已废弃；IAM 须在 Gateway 火山凭证中配置 */
export function resolveVolcenginePortraitCredentialsFromEnv(): VolcenginePortraitIam | null {
  return null;
}

/** 兼容旧 AK:SK 单字段 · 不含 ark Key */
export function parseVolcenginePortraitCredentialsFromApiKey(
  apiKey: string,
): VolcenginePortraitIam | null {
  const parsed = parseVolcengineGatewayCredential(apiKey);
  return parsed.portraitIam ?? null;
}
