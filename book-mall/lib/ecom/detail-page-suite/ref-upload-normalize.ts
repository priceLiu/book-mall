import { normalizeCanvasUploadImageBuffer } from "@/lib/canvas/canvas-image-upload-normalize";

/** 详情页套图 / 复刻 · 参考图上传后规范化（HEIC、错误 MIME、超大边长等） */
export async function normalizeDetailPageSuiteReferenceForStorage(
  buf: Buffer,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  if (buf.byteLength === 0) {
    throw new Error("空文件");
  }
  return normalizeCanvasUploadImageBuffer(buf);
}
