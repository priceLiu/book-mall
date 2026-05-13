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
export async function createOssClientFrom(cfg: OssEnvConfig) {
  const OSS = (await import("ali-oss")).default;
  return new OSS({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    region: cfg.region,
    authorizationV4: true,
    bucket: cfg.bucket,
    secure: true,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
  });
}
