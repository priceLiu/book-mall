import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

function parseDataUrl(dataUrl: string): { buf: Buffer; contentType: string; ext: string } {
  const trimmed = dataUrl.trim();
  const comma = trimmed.indexOf(",");
  if (comma < 0) throw new Error("无效的 dataUrl");
  const header = trimmed.slice(0, comma);
  const payload = trimmed.slice(comma + 1);
  const match = /^data:([^;]+);base64$/i.exec(header);
  if (!match) throw new Error("无效的 dataUrl");
  const contentType = match[1].trim().toLowerCase();
  const buf = Buffer.from(payload, "base64");
  if (contentType.startsWith("image/")) {
    const ext =
      contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : "jpg";
    return { buf, contentType, ext };
  }
  if (contentType.startsWith("video/")) {
    return { buf, contentType, ext: "mp4" };
  }
  if (contentType.startsWith("audio/")) {
    return { buf, contentType, ext: "mp3" };
  }
  throw new Error("不支持的文件类型");
}

export async function uploadQuickReplicaAsset(args: {
  userId: string;
  dataUrl: string;
  kind: "image" | "video" | "audio";
}): Promise<{ url: string }> {
  const { buf, contentType, ext } = parseDataUrl(args.dataUrl);
  const maxBytes =
    args.kind === "video" ? 200 * 1024 * 1024 : args.kind === "audio" ? 20 * 1024 * 1024 : 30 * 1024 * 1024;
  if (buf.byteLength > maxBytes) {
    throw new Error("文件过大");
  }
  const url = await uploadCanvasUserBuffer({
    userId: args.userId,
    buf,
    contentType,
    ext,
    preferBucketUrl: true,
  });
  return { url };
}
