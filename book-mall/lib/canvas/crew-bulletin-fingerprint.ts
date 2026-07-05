/** 从 CanvasProject.canvas JSON 提取公告条协作指纹（task-sync 订阅用） */
export function fingerprintBulletinFromCanvasJson(
  canvas: unknown,
): string {
  if (!canvas || typeof canvas !== "object") return "";
  const meta = (canvas as { meta?: { crewBulletinAnchor?: { crewBulletin?: { tasks?: Array<{ id: string; status: string; assigneeUserId?: string; canvasNodeId?: string; completedAt?: string }> }; scriptStudioCharacterRows?: unknown[]; scriptStudioFrameRows?: unknown[] } } }).meta;
  const anchor = meta?.crewBulletinAnchor;
  const tasks = anchor?.crewBulletin?.tasks;
  if (!tasks?.length) return "";
  const taskSig = tasks
    .map(
      (t) =>
        `${t.id}:${t.status}:${t.assigneeUserId ?? ""}:${t.canvasNodeId ?? ""}:${t.completedAt ?? ""}`,
    )
    .join(";");
  const rows =
    (anchor?.scriptStudioCharacterRows?.length ?? 0) +
    (anchor?.scriptStudioFrameRows?.length ?? 0);
  return `${taskSig}|rows:${rows}`;
}
