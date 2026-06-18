/**
 * 私域人像库 · IAM Access Key（AK/SK），与 ark- Bearer API Key 分离
 */

export type VolcenginePortraitCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  host?: string;
};

export function resolveVolcenginePortraitCredentialsFromEnv(): VolcenginePortraitCredentials | null {
  const accessKeyId =
    process.env.VOLCENGINE_ACCESS_KEY?.trim() ||
    process.env.VOLCENGINE_PORTRAIT_ACCESS_KEY?.trim();
  const secretAccessKey =
    process.env.VOLCENGINE_SECRET_ACCESS_KEY?.trim() ||
    process.env.VOLCENGINE_PORTRAIT_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey };
}

/** Gateway 凭证字段可存 JSON 或 `AK...:SK...`（Portrait 专用，非 ark- Key） */
export function parseVolcenginePortraitCredentialsFromApiKey(
  apiKey: string,
): VolcenginePortraitCredentials | null {
  const trimmed = apiKey.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      const row = JSON.parse(trimmed) as Record<string, unknown>;
      const accessKeyId = String(
        row.accessKeyId ?? row.accessKey ?? row.ak ?? "",
      ).trim();
      const secretAccessKey = String(
        row.secretAccessKey ?? row.secretKey ?? row.sk ?? "",
      ).trim();
      if (accessKeyId && secretAccessKey) {
        return { accessKeyId, secretAccessKey };
      }
    } catch {
      /* ignore */
    }
  }

  const colon = trimmed.indexOf(":");
  if (colon > 0 && trimmed.startsWith("AK")) {
    return {
      accessKeyId: trimmed.slice(0, colon),
      secretAccessKey: trimmed.slice(colon + 1),
    };
  }

  return null;
}

export function resolveVolcenginePortraitCredentials(
  fallbackApiKey?: string | null,
): VolcenginePortraitCredentials {
  const fromEnv = resolveVolcenginePortraitCredentialsFromEnv();
  if (fromEnv) return fromEnv;
  if (fallbackApiKey) {
    const parsed = parseVolcenginePortraitCredentialsFromApiKey(fallbackApiKey);
    if (parsed) return parsed;
  }
  throw new Error(
    "私域人像库需配置 IAM Access Key：环境变量 VOLCENGINE_ACCESS_KEY + VOLCENGINE_SECRET_ACCESS_KEY（非 ark- API Key）",
  );
}
