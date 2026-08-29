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
  const normalized = normalizePastedImageFile(file);
  if (!IMAGE_UPLOAD_MIME_TYPES.has(normalized.type)) {
    return { title: "格式不支持", message: "请上传 JPG、PNG 或 WebP 图片" };
  }
  if (normalized.size > IMAGE_UPLOAD_MAX_BYTES) {
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
  if (!type) return true; // macOS 截图等粘贴项常无 MIME
  if (type.startsWith("image/")) return true;
  return allowVideo && type.startsWith("video/");
}

/** 剪贴板 / 拖放图片常无 type，补全为 png 以便校验与上传 */
export function normalizePastedImageFile(file: File): File {
  if (file.type && IMAGE_UPLOAD_MIME_TYPES.has(file.type)) return file;
  const base = file.name?.replace(/\.[^.]+$/, "") || `paste-${Date.now()}`;
  const name = /\.(jpe?g|png|webp)$/i.test(file.name) ? file.name : `${base}.png`;
  const type =
    /\.jpe?g$/i.test(name) ? "image/jpeg" : /\.webp$/i.test(name) ? "image/webp" : "image/png";
  return new File([file], name, { type, lastModified: file.lastModified });
}

function collectFilesFromDataTransfer(
  data: DataTransfer,
  opts?: { allowVideo?: boolean },
): File[] {
  const allowVideo = Boolean(opts?.allowVideo);
  const out: File[] = [];
  const seen = new Set<string>();

  const push = (file: File | null) => {
    if (!file) return;
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!mimeMatchesUploadKinds(file.type, allowVideo)) return;
    out.push(file.type.startsWith("image/") || !file.type ? normalizePastedImageFile(file) : file);
  };

  if (data.files?.length) {
    for (const file of Array.from(data.files)) push(file);
  }
  if (out.length === 0 && data.items?.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind !== "file") continue;
      if (!mimeMatchesUploadKinds(item.type, allowVideo)) continue;
      push(item.getAsFile());
    }
  }
  return out;
}

export function extractMediaFilesFromDataTransfer(
  dt: DataTransfer,
  opts?: { allowVideo?: boolean },
): File[] {
  return collectFilesFromDataTransfer(dt, opts);
}

export function extractImageFilesFromDataTransfer(dt: DataTransfer): File[] {
  return extractMediaFilesFromDataTransfer(dt);
}

export function extractImageFileFromClipboard(
  clipboard: DataTransfer | null,
): File | null {
  const files = clipboard ? collectFilesFromDataTransfer(clipboard) : [];
  return files[0] ?? null;
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
  if (!data) return [];
  return collectFilesFromDataTransfer(data, opts);
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
