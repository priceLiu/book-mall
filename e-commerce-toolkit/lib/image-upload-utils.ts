export const IMAGE_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp";

export const IMAGE_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const IMAGE_UPLOAD_HINT = "JPG、PNG、WebP，最大 10MB";

export const IMAGE_UPLOAD_DROP_HINT = "拖放、粘贴或点击上传";

export const VIDEO_UPLOAD_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export const VIDEO_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

export const IMAGE_OR_VIDEO_UPLOAD_ACCEPT = `${IMAGE_UPLOAD_ACCEPT},video/mp4,video/quicktime,video/webm`;

export type ImageUploadError = { title: string; message: string };

export function validateImageFile(file: File): ImageUploadError | null {
  if (!IMAGE_UPLOAD_MIME_TYPES.has(file.type)) {
    return { title: "格式不支持", message: "请上传 JPG、PNG 或 WebP 图片" };
  }
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    return { title: "文件过大", message: "图片最大 10MB" };
  }
  return null;
}

export function validateImageOrVideoFile(file: File): ImageUploadError | null {
  if (file.type.startsWith("image/") || IMAGE_UPLOAD_MIME_TYPES.has(file.type)) {
    return validateImageFile(file);
  }
  if (file.type.startsWith("video/") || VIDEO_UPLOAD_MIME_TYPES.has(file.type)) {
    if (!VIDEO_UPLOAD_MIME_TYPES.has(file.type)) {
      return { title: "格式不支持", message: "视频请使用 MP4、MOV 或 WebM" };
    }
    if (file.size > VIDEO_UPLOAD_MAX_BYTES) {
      return { title: "文件过大", message: "视频最大 100MB" };
    }
    return null;
  }
  return {
    title: "格式不支持",
    message: "请上传 JPG/PNG/WebP 图片，或 MP4/MOV/WebM 视频",
  };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function mimeMatchesUploadKinds(type: string, allowVideo: boolean): boolean {
  if (type.startsWith("image/")) return true;
  return allowVideo && type.startsWith("video/");
}

export function extractMediaFilesFromDataTransfer(
  dt: DataTransfer,
  opts?: { allowVideo?: boolean },
): File[] {
  const allowVideo = Boolean(opts?.allowVideo);
  const out: File[] = [];
  if (dt.files?.length) {
    for (const file of Array.from(dt.files)) {
      if (mimeMatchesUploadKinds(file.type, allowVideo)) out.push(file);
    }
  }
  if (out.length === 0 && dt.items?.length) {
    for (const item of Array.from(dt.items)) {
      if (!mimeMatchesUploadKinds(item.type, allowVideo)) continue;
      const file = item.getAsFile();
      if (file) out.push(file);
    }
  }
  return out;
}

export function extractImageFilesFromDataTransfer(dt: DataTransfer): File[] {
  return extractMediaFilesFromDataTransfer(dt);
}

export function extractImageFileFromClipboard(
  clipboard: DataTransfer | null,
): File | null {
  if (!clipboard?.items?.length) return null;
  for (const item of Array.from(clipboard.items)) {
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

/** 从剪贴板事件提取图片 File（支持多图粘贴，对齐 QuickReplica） */
export function extractImageFilesFromClipboard(
  event: ClipboardEvent | React.ClipboardEvent,
): File[] {
  return extractMediaFilesFromClipboard(event);
}

export function extractMediaFilesFromClipboard(
  event: ClipboardEvent | React.ClipboardEvent,
  opts?: { allowVideo?: boolean },
): File[] {
  const data = "clipboardData" in event ? event.clipboardData : null;
  if (!data?.items?.length) return [];

  const allowVideo = Boolean(opts?.allowVideo);
  const files: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    if (!mimeMatchesUploadKinds(item.type, allowVideo)) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}

export async function filesToDataUrls(
  files: File[],
  opts?: { max?: number; onError?: (err: ImageUploadError) => void },
): Promise<string[]> {
  const max = opts?.max ?? files.length;
  const urls: string[] = [];
  for (const file of files) {
    if (urls.length >= max) break;
    const err = validateImageFile(file);
    if (err) {
      opts?.onError?.(err);
      continue;
    }
    urls.push(await readFileAsDataUrl(file));
  }
  return urls;
}
