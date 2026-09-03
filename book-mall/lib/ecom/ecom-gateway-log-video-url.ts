import { extractBailianR2vVideoUrlFromGatewaySummary } from "@/lib/canvas/canvas-video-bailian-r2v";
import { extractVolcengineVideoUrlFromGatewaySummary } from "@/lib/canvas/canvas-volcengine-recover";
import { dashscopeExtractTaskVideoUrl } from "@/lib/gateway/dashscope-client";
import { minimaxVideoTaskResultUrl } from "@/lib/gateway/minimax-video-client";
import type { MinimaxVideoTaskRow } from "@/lib/gateway/minimax-video-client";
import { extractKieResultUrl } from "@/lib/story/kie-client";
import type { KieRecordResponse } from "@/lib/story/kie-client";
import { prisma } from "@/lib/prisma";

function extractMinimaxVideoUrlFromGatewaySummary(summary: unknown): string | null {
  if (!summary || typeof summary !== "object") return null;
  const root = summary as Record<string, unknown>;

  const fromRow = minimaxVideoTaskResultUrl(root as MinimaxVideoTaskRow);
  if (fromRow) return fromRow;

  const task = root.task;
  if (task && typeof task === "object") {
    const fromTask = minimaxVideoTaskResultUrl(task as MinimaxVideoTaskRow);
    if (fromTask) return fromTask;
    const taskRecord = task as Record<string, unknown>;
    const taskContent = taskRecord.content;
    if (taskContent && typeof taskContent === "object") {
      const url = (taskContent as { url?: string }).url;
      if (typeof url === "string" && url.trim() && /^https?:\/\//i.test(url.trim())) {
        return url.trim();
      }
    }
  }

  return extractGenericVideoUrl(summary);
}

function extractGenericVideoUrl(summary: unknown): string | null {
  if (!summary || typeof summary !== "object") return null;
  const root = summary as Record<string, unknown>;
  for (const key of ["video_url", "videoUrl", "outputUrl"] as const) {
    const raw = root[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  const output = root.output;
  if (output && typeof output === "object") {
    const nested = output as Record<string, unknown>;
    for (const key of ["video_url", "videoUrl"] as const) {
      const raw = nested[key];
      if (typeof raw === "string" && raw.trim()) return raw.trim();
    }
  }
  const content = root.content;
  if (content && typeof content === "object") {
    const nested = content as Record<string, unknown>;
    for (const key of ["video_url", "videoUrl", "url"] as const) {
      const raw = nested[key];
      if (typeof raw === "string" && raw.trim() && /^https?:\/\//i.test(raw.trim())) {
        return raw.trim();
      }
    }
  }
  const task = root.task;
  if (task && typeof task === "object") {
    const nested = extractGenericVideoUrl(task);
    if (nested) return nested;
  }
  return null;
}

export type GatewayLogVideoPollProvider =
  | "kie"
  | "bailian"
  | "volcengine"
  | "dashscope"
  | "minimax";

function resolveGatewayLogVideoPollProvider(
  pollProvider: GatewayLogVideoPollProvider | undefined,
  providerKind: string | null | undefined,
): GatewayLogVideoPollProvider | undefined {
  if (pollProvider) return pollProvider;
  if (providerKind === "BAILIAN") return "bailian";
  if (providerKind === "VOLCENGINE") return "volcengine";
  if (providerKind === "DASHSCOPE") return "dashscope";
  if (providerKind === "MINIMAX") return "minimax";
  if (providerKind === "KIE") return "kie";
  return undefined;
}

/** 从 Gateway resultSummary 提取视频 URL（同步 · 供 resume / recordInfo） */
export function extractVideoUrlFromGatewayLogSummary(
  summary: unknown,
  opts?: {
    pollProvider?: GatewayLogVideoPollProvider;
    providerKind?: string | null;
  },
): string | null {
  const provider = resolveGatewayLogVideoPollProvider(
    opts?.pollProvider,
    opts?.providerKind,
  );

  if (provider === "bailian") {
    return (
      extractBailianR2vVideoUrlFromGatewaySummary(summary) ??
      extractGenericVideoUrl(summary)
    );
  }
  if (provider === "volcengine") {
    return (
      extractVolcengineVideoUrlFromGatewaySummary(summary) ??
      extractGenericVideoUrl(summary)
    );
  }
  if (provider === "dashscope") {
    if (summary && typeof summary === "object") {
      const direct = dashscopeExtractTaskVideoUrl(summary as Record<string, unknown>);
      if (direct) return direct;
      const output = (summary as Record<string, unknown>).output;
      if (output && typeof output === "object") {
        const nested = dashscopeExtractTaskVideoUrl(output as Record<string, unknown>);
        if (nested) return nested;
      }
    }
    return extractGenericVideoUrl(summary);
  }
  if (provider === "minimax") {
    return extractMinimaxVideoUrlFromGatewaySummary(summary);
  }
  if (provider === "kie") {
    if (summary && typeof summary === "object") {
      const fromKie = extractKieResultUrl(summary as KieRecordResponse);
      if (fromKie) return fromKie;
    }
    return extractGenericVideoUrl(summary);
  }

  return (
    extractBailianR2vVideoUrlFromGatewaySummary(summary) ??
    extractVolcengineVideoUrlFromGatewaySummary(summary) ??
    extractMinimaxVideoUrlFromGatewaySummary(summary) ??
    (summary && typeof summary === "object"
      ? extractKieResultUrl(summary as KieRecordResponse)
      : null) ??
    extractGenericVideoUrl(summary)
  );
}

/** Gateway 日志已 SUCCEEDED 时，从 resultSummary 提取厂商/落库视频 URL */
export async function readGatewayLogVideoOutputUrl(opts: {
  logId: string;
  pollProvider?: GatewayLogVideoPollProvider;
}): Promise<string | null> {
  const logId = opts.logId.trim();
  if (!logId) return null;

  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { status: true, resultSummary: true, providerKind: true },
  });
  if (!log || log.status !== "SUCCEEDED") return null;

  return extractVideoUrlFromGatewayLogSummary(log.resultSummary, {
    pollProvider: opts.pollProvider,
    providerKind: log.providerKind,
  });
}
