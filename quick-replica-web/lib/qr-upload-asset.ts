import { fetchQrPlatform } from "@/lib/qr-platform-fetch";

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

export async function uploadQrAsset(
  file: File,
  kind: "image" | "video" | "audio",
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const res = await fetchQrPlatform(
    "/api/book-mall/api/platform/v1/quick-replica/assets/upload",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, kind }),
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "上传失败");
  }
  const data = (await res.json()) as { url?: string };
  const url = data.url?.trim();
  if (!url) throw new Error("上传失败");
  return url;
}
