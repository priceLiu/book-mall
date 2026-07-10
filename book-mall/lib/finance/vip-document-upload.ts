import {
  createOssClientFrom,
  ossPublicUrlForKey,
  ossUploadBuffer,
  readOssEnv,
  withOssRetry,
} from "@/lib/oss-client";
import type { VipDealDocumentKind } from "@prisma/client";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-()\u4e00-\u9fff]+/g, "_").slice(0, 120) || "file";
}

export async function uploadVipDealDocument(input: {
  buf: Buffer;
  filename: string;
  mimeType: string;
  tenantId?: string | null;
  ownerUserId?: string | null;
  kind: VipDealDocumentKind;
}): Promise<{ ossUrl: string; key: string }> {
  if (input.buf.byteLength > MAX_BYTES) {
    throw new Error(`文件过大（上限 ${MAX_BYTES / 1024 / 1024}MB）`);
  }
  const mime = input.mimeType.split(";")[0].trim().toLowerCase() || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("仅支持 PDF、图片或 Word 文档");
  }

  const env = readOssEnv();
  if ("error" in env) throw new Error(env.error);

  const scope = input.tenantId?.trim() || input.ownerUserId?.trim() || "unscoped";
  const safeName = sanitizeFilename(input.filename);
  const key = `vip-deals/${scope}/${input.kind.toLowerCase()}/${Date.now()}-${safeName}`;

  const result = await withOssRetry("vip-deal-upload", async () => {
    const client = await createOssClientFrom(env, { timeoutMs: 120_000 });
    return ossUploadBuffer(client, {
      key,
      buf: input.buf,
      contentType: mime,
      useMultipart: input.buf.byteLength > 5 * 1024 * 1024,
      timeoutMs: 120_000,
    });
  });

  const sdkUrl = typeof result.url === "string" ? result.url.trim() : "";
  const ossUrl = /^https:\/\//i.test(sdkUrl) ? sdkUrl : ossPublicUrlForKey(env, key);

  return { ossUrl, key };
}
