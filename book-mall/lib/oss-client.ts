export type OssEnvConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  region: string;
  bucket: string;
  /** 仅当与默认推导不一致时再设；须与 Bucket 地域匹配，否则报 endpoint 错误 */
  endpoint?: string;
};

/** Read OSS settings from env（与 tool-web 一致，便于主站删除库记录时同步删对象） */
export function readOssEnv(): OssEnvConfig | { error: string } {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim();
  const bucket = process.env.OSS_BUCKET?.trim();
  if (!accessKeyId || !accessKeySecret || !bucket) {
    return {
      error:
        "未配置 OSS：请在 .env.local 设置 OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_BUCKET",
    };
  }
  const region = process.env.OSS_REGION?.trim() || "oss-cn-guangzhou";
  const endpoint = process.env.OSS_ENDPOINT?.trim();
  return {
    accessKeyId,
    accessKeySecret,
    region,
    bucket,
    ...(endpoint ? { endpoint } : {}),
  };
}

/** 运行时动态加载 ali-oss */
export async function createOssClientFrom(
  cfg: OssEnvConfig,
  opts?: { timeoutMs?: number },
) {
  const OSS = (await import("ali-oss")).default;
  return new OSS({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    region: cfg.region,
    authorizationV4: true,
    bucket: cfg.bucket,
    secure: true,
    timeout: opts?.timeoutMs ?? 60_000,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
  } as ConstructorParameters<typeof OSS>[0]);
}

type OssMultipartClient = {
  multipartUpload: (
    name: string,
    file: Buffer,
    options?: Record<string, unknown>,
  ) => Promise<{ url?: string }>;
};

/** ali-oss 运行时支持 multipartUpload，但 @types 未声明 */
export async function ossUploadBuffer(
  client: Awaited<ReturnType<typeof createOssClientFrom>>,
  args: {
    key: string;
    buf: Buffer;
    contentType: string;
    useMultipart: boolean;
    timeoutMs: number;
    /** 分片并发；回填大文件建议 1~2 降低 TLS 断连 */
    multipartParallel?: number;
  },
): Promise<{ url?: string }> {
  const ct = args.contentType.split(";")[0].trim() || "application/octet-stream";
  if (args.useMultipart) {
    return (client as unknown as OssMultipartClient).multipartUpload(
      args.key,
      args.buf,
      {
        parallel: args.multipartParallel ?? 4,
        partSize: 1024 * 1024,
        timeout: args.timeoutMs,
        mime: ct,
        headers: {
          "Content-Type": ct,
          "x-oss-object-acl": "public-read",
        },
      },
    );
  }
  return client.put(args.key, args.buf, {
    headers: { "Content-Type": ct },
    ACL: "public-read",
  });
}

/** 经 OSS SDK 读对象（比 fetch 公网 URL 更稳；支持 Range） */
export async function ossGetBuffer(
  client: Awaited<ReturnType<typeof createOssClientFrom>>,
  args: { key: string; range?: string; timeoutMs?: number },
): Promise<Buffer | null> {
  const res = await client.get(args.key, {
    timeout: args.timeoutMs ?? 120_000,
    ...(args.range ? { headers: { Range: args.range } } : {}),
  });
  const content = (res as { content?: Buffer }).content;
  return content && content.byteLength ? content : null;
}

const RETRYABLE = /ResponseError|timeout|ECONNRESET|ETIMEDOUT|socket disconnected/i;

/** OSS 读写重试（指数退避） */
export async function withOssRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number },
): Promise<T> {
  const attempts = opts?.attempts ?? 4;
  const baseDelayMs = opts?.baseDelayMs ?? 2000;
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (i >= attempts || !RETRYABLE.test(msg)) throw e;
      const wait = baseDelayMs * i;
      console.warn(`${label} retry ${i}/${attempts - 1} in ${wait}ms (${msg.slice(0, 80)})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}
