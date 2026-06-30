import { fetchQrPlatform } from "@/lib/qr-platform-fetch";
import type { QrGenerateJobResult } from "@/components/quick-replica/qr-workspace-panel";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_MS = 15 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollOnce(logId: string): Promise<QrGenerateJobResult | null> {
  const pollRes = await fetchQrPlatform(
    `/api/book-mall/api/platform/v1/quick-replica/jobs/${encodeURIComponent(logId)}`,
  );
  if (!pollRes.ok) return null;
  return (await pollRes.json()) as QrGenerateJobResult;
}

export type QrGenerateJobRun = QrGenerateJobResult & { logId?: string };

export async function runQrGenerateJob(
  draft: import("@/lib/qr-template-types").QrWorkspaceDraft,
): Promise<QrGenerateJobRun> {
  const createRes = await fetchQrPlatform(
    "/api/book-mall/api/platform/v1/quick-replica/jobs/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    },
  );
  if (!createRes.ok) {
    const body = (await createRes.json().catch(() => ({}))) as { error?: string };
    return {
      status: "FAILED",
      error: body.error ?? `创建任务失败（${createRes.status}）`,
    };
  }
  const created = (await createRes.json()) as { logId: string };
  const logId = created.logId;
  const deadline = Date.now() + MAX_POLL_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const job = await pollOnce(logId);
    if (!job) continue;
    if (job.status === "FAILED") {
      return { ...job, logId };
    }
    if (job.status === "SUCCEEDED") {
      if (job.outputUrl) {
        return { ...job, logId };
      }
      // 日志已成功但 URL 解析延迟，继续轮询
      continue;
    }
  }

  const final = await pollOnce(logId);
  if (final?.status === "SUCCEEDED" && final.outputUrl) {
    return { ...final, logId };
  }
  if (final?.status === "FAILED") {
    return { ...final, logId };
  }

  return {
    status: "FAILED",
    logId,
    error: "轮询超时，可在「生成记录」中查看是否已完成",
  };
}

export async function refreshQrGenerateJob(logId: string): Promise<QrGenerateJobRun> {
  const job = await pollOnce(logId);
  if (!job) {
    return { status: "FAILED", logId, error: "无法获取任务状态" };
  }
  return { ...job, logId };
}

export async function saveQrGenerateJobToMyWorks(
  logId: string,
): Promise<{ template?: import("@/lib/qr-template-types").QrTemplate; error?: string }> {
  const res = await fetchQrPlatform(
    `/api/book-mall/api/platform/v1/quick-replica/jobs/${encodeURIComponent(logId)}/save-template`,
    { method: "POST" },
  );
  const data = (await res.json().catch(() => ({}))) as {
    template?: import("@/lib/qr-template-types").QrTemplate;
    error?: string;
  };
  if (!res.ok || !data.template) {
    return { error: data.error ?? `保存失败（${res.status}）` };
  }
  return { template: data.template };
}

export type QrGenerateJobRecord = {
  logId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  submittedAt: string;
  completedAt?: string;
  title: string;
  kind: string;
  category: string;
  modelKey: string;
  previewImageUrl?: string;
  outputUrl?: string;
  error?: string;
  savedTemplateId?: string;
};

export async function fetchQrGenerateJobRecords(limit = 40): Promise<QrGenerateJobRecord[]> {
  const res = await fetchQrPlatform(
    `/api/book-mall/api/platform/v1/quick-replica/jobs?limit=${limit}`,
    { cache: "no-store" },
  );
  const data = (await res.json().catch(() => ({}))) as {
    jobs?: QrGenerateJobRecord[];
    error?: string;
  };
  if (!res.ok || !Array.isArray(data.jobs)) {
    throw new Error(data.error ?? `加载失败（${res.status}）`);
  }
  return data.jobs;
}

export async function deleteQrUserTemplate(
  templateId: string,
): Promise<{ ok: true } | { error: string }> {
  const res = await fetchQrPlatform(
    `/api/book-mall/api/platform/v1/quick-replica/templates/${encodeURIComponent(templateId)}`,
    { method: "DELETE" },
  );
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { error: data.error ?? `删除失败（${res.status}）` };
  }
  return { ok: true };
}
