import type { QrTemplate } from "@/lib/qr-template-types";

function extFromUrl(url: string): string {
  const path = url.split("?")[0] ?? url;
  const dot = path.lastIndexOf(".");
  if (dot >= 0) {
    const ext = path.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]{2,5}$/.test(ext)) return ext;
  }
  return "mp3";
}

function safeFilename(title: string): string {
  const base = title.trim().replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80);
  return base || "quick-replica-output";
}

export async function downloadQrTemplateOutput(template: QrTemplate): Promise<void> {
  const url = template.output?.url?.trim();
  if (!url) return;

  const filename = `${safeFilename(template.title)}.${extFromUrl(url)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
