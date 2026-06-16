import {
  getCanvasProjectHistoryEntry,
  type CanvasGenerationRecord,
} from "@/lib/canvas-api";

export function generationRecordDisplayTitle(item: CanvasGenerationRecord): string {
  if (item.providerLabel && item.modelLabel) {
    return `${item.providerLabel} · ${item.modelLabel}`;
  }
  if (item.modelLabel) return item.modelLabel;
  return item.model;
}

export function canRestoreGenerationRecordCanvas(
  item: CanvasGenerationRecord,
): boolean {
  return Boolean(item.canRestoreCanvas && item.canvasHistoryId);
}

export async function fetchGenerationRecordCanvas(
  base: string,
  record: CanvasGenerationRecord,
  currentProjectId: string,
): Promise<{ ok: true; canvas: unknown } | { ok: false; message: string }> {
  const historyId = record.canvasHistoryId;
  const targetProjectId = record.projectId ?? currentProjectId;
  if (!historyId || !targetProjectId) {
    return {
      ok: false,
      message: "该记录没有绑定的画布快照。新发起的生成会自动保存快照；旧记录可尝试在「我的历史」中按时间查找。",
    };
  }

  try {
    const detail = await getCanvasProjectHistoryEntry(
      base,
      targetProjectId,
      historyId,
    );
    return { ok: true, canvas: detail.canvas };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: raw.includes("history not found")
        ? "画布快照已不存在（可能已被清理）。"
        : raw,
    };
  }
}

export function buildGenerationRecordCanvasHref(
  record: CanvasGenerationRecord,
  currentProjectId: string,
  action: "focus" | "restoreCanvas",
): string | null {
  const targetProjectId = record.projectId ?? currentProjectId;
  if (!record.nodeId || !targetProjectId) return null;
  const q = new URLSearchParams();
  if (action === "focus") {
    q.set("focusNode", record.nodeId);
    return `/canvas/${targetProjectId}?${q.toString()}`;
  }
  if (action === "restoreCanvas" && record.canvasHistoryId) {
    q.set("restoreHistory", record.canvasHistoryId);
    if (record.nodeId) q.set("focusNode", record.nodeId);
    return `/canvas/${targetProjectId}?${q.toString()}`;
  }
  return null;
}
