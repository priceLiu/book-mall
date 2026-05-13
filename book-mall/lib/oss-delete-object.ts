import { createOssClientFrom, readOssEnv, type OssEnvConfig } from "@/lib/oss-client";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeDecodeKey(key: string): string {
  if (!key) return key;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

/**
 * 从本系统写入的 OSS 公网 URL 解析 object key（支持 OSS_PUBLIC_URL_BASE 自定义域名与 Bucket 三级域名）。
 */
export function extractManagedOssObjectKey(
  publicUrl: string,
  cfg: OssEnvConfig | null,
): string | null {
  let u: URL;
  try {
    u = new URL(publicUrl.trim());
  } catch {
    return null;
  }

  const publicBase = process.env.OSS_PUBLIC_URL_BASE?.trim();
  if (publicBase) {
    try {
      const bu = new URL(publicBase);
      if (u.origin === bu.origin) {
        let path = u.pathname;
        const bp = bu.pathname.replace(/\/$/, "") || "";
        if (bp && path.startsWith(bp + "/")) {
          path = path.slice(bp.length + 1);
        } else if (bp && path === bp) {
          path = "";
        } else if (!bp) {
          path = path.replace(/^\//, "");
        } else {
          return null;
        }
        const k = safeDecodeKey(path);
        return k || null;
      }
    } catch {
      /* ignore */
    }
  }

  if (!cfg) return null;

  const bucketLower = cfg.bucket.trim().toLowerCase();
  const host = u.hostname.toLowerCase();
  const re = new RegExp(
    `^${escapeRegExp(bucketLower)}\\.oss-[a-z0-9-]+\\.aliyuncs\\.com$`,
    "i",
  );
  if (!re.test(host)) return null;

  const raw = u.pathname.replace(/^\//, "");
  if (!raw) return null;
  return safeDecodeKey(raw);
}

/**
 * 若 URL 归属于当前环境配置的 OSS，则删除对象；否则视为外链并跳过（仍返回 ok）。
 * 未配置 OSS 且解析出 key 时返回失败（避免只删库不删文件却误以为一致）。
 */
export async function deleteManagedOssObjectByUrl(publicUrl: string): Promise<
  | { ok: true; deleted: boolean }
  | { ok: false; error: string }
> {
  const cfgRaw = readOssEnv();
  const key = extractManagedOssObjectKey(
    publicUrl,
    "error" in cfgRaw ? null : cfgRaw,
  );

  if (!key) {
    return { ok: true, deleted: false };
  }

  if ("error" in cfgRaw) {
    return {
      ok: false,
      error:
        "该记录指向自有 OSS 路径，但主站未配置 OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_BUCKET，无法删除对象",
    };
  }

  try {
    const client = await createOssClientFrom(cfgRaw);
    await client.delete(key);
    return { ok: true, deleted: true };
  } catch (e) {
    const status =
      e && typeof e === "object" && "status" in e
        ? Number((e as { status: number }).status)
        : 0;
    if (status === 404) {
      return { ok: true, deleted: false };
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[oss-delete-object]", key, msg);
    return { ok: false, error: msg || "OSS 删除失败" };
  }
}
