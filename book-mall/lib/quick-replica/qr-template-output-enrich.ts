import { prisma } from "@/lib/prisma";
import { extractQrJobOutputUrl } from "@/lib/quick-replica/qr-job-output";
import {
  isImageMediaUrl,
  isVideoMediaUrl,
} from "@/lib/quick-replica/qr-template-preview-media";
import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";

export function qrTemplateNeedsVideoOutputHydration(t: QrTemplateJson): boolean {
  const isVideoTemplate =
    t.category === "video" || t.reference?.model?.role === "VIDEO";
  if (!isVideoTemplate) return false;

  const logId = t.output?.gatewayRequestLogId?.trim();
  if (!logId) return false;

  const refVideo = t.reference?.slots?.referenceVideo?.url?.trim() ?? "";
  const outUrl = t.output?.url?.trim() ?? "";
  if (!outUrl) return true;
  if (refVideo && outUrl === refVideo) return true;
  if (isImageMediaUrl(outUrl)) return true;
  if (t.output?.mediaType !== "video" && !isVideoMediaUrl(outUrl)) return true;
  return false;
}

function pickVideoUrlFromLog(resultSummary: unknown): string | null {
  const extracted = extractQrJobOutputUrl(resultSummary);
  if (!extracted?.url?.trim()) return null;
  const url = extracted.url.trim();
  if (extracted.mediaType === "audio") return null;
  if (extracted.mediaType === "video" || isVideoMediaUrl(url)) return url;
  if (isImageMediaUrl(url)) return null;
  return url;
}

/** 列表/详情：从 Gateway 日志补全运动同步等视频的成片 URL，并异步回写 DB */
export async function enrichQrTemplatesVideoOutput(
  templates: QrTemplateJson[],
): Promise<QrTemplateJson[]> {
  if (templates.length === 0) return templates;

  const pending: Array<{ index: number; logId: string; refVideo: string; id: string }> =
    [];
  templates.forEach((t, index) => {
    if (!qrTemplateNeedsVideoOutputHydration(t)) return;
    const logId = t.output?.gatewayRequestLogId?.trim();
    if (!logId) return;
    pending.push({
      index,
      logId,
      refVideo: t.reference?.slots?.referenceVideo?.url?.trim() ?? "",
      id: t.id,
    });
  });
  if (pending.length === 0) return templates;

  const logIds = [...new Set(pending.map((p) => p.logId))];
  const logs = await prisma.gatewayRequestLog.findMany({
    where: { id: { in: logIds } },
    select: { id: true, status: true, resultSummary: true },
  });
  const logById = new Map(logs.map((l) => [l.id, l]));

  const out = templates.slice();
  const repairs: Array<{ id: string; output: QrTemplateJson["output"] }> = [];

  for (const item of pending) {
    const log = logById.get(item.logId);
    if (!log || log.status !== "SUCCEEDED") continue;
    const videoUrl = pickVideoUrlFromLog(log.resultSummary);
    if (!videoUrl) continue;
    if (item.refVideo && videoUrl === item.refVideo) continue;

    const prev = out[item.index]!;
    const nextOutput: NonNullable<QrTemplateJson["output"]> = {
      mediaType: "video",
      url: videoUrl,
      gatewayRequestLogId: item.logId,
      createdAt: prev.output?.createdAt ?? prev.createdAt,
    };
    out[item.index] = { ...prev, output: nextOutput };
    if (prev.source === "user") {
      repairs.push({ id: item.id, output: nextOutput });
    }
  }

  if (repairs.length > 0) {
    void Promise.all(
      repairs.map((r) =>
        prisma.qrTemplate.update({
          where: { id: r.id },
          data: { output: r.output as object },
        }),
      ),
    ).catch(() => undefined);
  }

  return out;
}

export async function enrichQrTemplateVideoOutput(
  template: QrTemplateJson | null,
): Promise<QrTemplateJson | null> {
  if (!template) return null;
  const [one] = await enrichQrTemplatesVideoOutput([template]);
  return one ?? template;
}
