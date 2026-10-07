/** 新建画布后若仍空白即离开，可丢弃项目（仅本会话；避免误删列表里旧的空画布） */

const SESSION_KEY_PREFIX = "canvas:discard-if-empty:";

export function markCanvasProjectDiscardIfStillEmpty(projectId: string): void {
  if (!projectId.trim()) return;
  try {
    sessionStorage.setItem(`${SESSION_KEY_PREFIX}${projectId}`, "1");
  } catch {
    /* private mode / quota */
  }
}

export function isCanvasProjectDiscardIfStillEmptySession(
  projectId: string,
): boolean {
  if (!projectId.trim()) return false;
  try {
    return (
      sessionStorage.getItem(`${SESSION_KEY_PREFIX}${projectId}`) === "1"
    );
  } catch {
    return false;
  }
}

export function clearCanvasProjectDiscardIfStillEmptySession(
  projectId: string,
): void {
  if (!projectId.trim()) return;
  try {
    sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${projectId}`);
  } catch {
    /* ignore */
  }
}

export type CanvasDiscardEmptyOnLeaveInput = {
  projectId: string;
  initialProjectName: string;
  projectNameDraft: string;
  nodeCount: number;
  edgeCount: number;
  everHadGraphContent: boolean;
  imageUploadPending: boolean;
  inflightTaskCount: number;
};

/** 离开「我的画布」时是否应静默删除新建且未使用的空白项目 */
export function shouldDiscardEmptyNewCanvasOnLeave(
  input: CanvasDiscardEmptyOnLeaveInput,
): boolean {
  if (!isCanvasProjectDiscardIfStillEmptySession(input.projectId)) {
    return false;
  }
  if (input.everHadGraphContent) return false;
  if (input.nodeCount > 0 || input.edgeCount > 0) return false;
  if (input.imageUploadPending || input.inflightTaskCount > 0) return false;

  const draft =
    input.projectNameDraft.trim() || input.initialProjectName.trim();
  if (draft !== input.initialProjectName.trim()) return false;

  return true;
}
