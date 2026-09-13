import { imageLayerComposeImageSrc } from "@/lib/image-layer-compose-image-src";
import { downloadBlob } from "@/lib/image-layer-export";

export async function downloadImageLayerUrl(url: string, filename: string) {
  const fetchUrl = imageLayerComposeImageSrc(url);
  const res = await fetch(fetchUrl, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
  const blob = await res.blob();
  downloadBlob(blob, filename);
}
