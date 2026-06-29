/** 公告条工作节点是否已有可提交产出（图/视频/成片 URL） */
export function nodeHasCrewTaskOutput(
  data: Record<string, unknown> | undefined | null,
): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as {
    ossUrl?: string;
    blobUrl?: string;
    imageUrl?: string;
    outputUrl?: string;
    videoUrl?: string;
    runtime?: { ossUrl?: string; ephemeralUrl?: string; status?: string };
  };
  return Boolean(
    d.ossUrl?.trim() ||
      d.blobUrl?.trim() ||
      d.imageUrl?.trim() ||
      d.outputUrl?.trim() ||
      d.videoUrl?.trim() ||
      d.runtime?.ossUrl?.trim() ||
      d.runtime?.ephemeralUrl?.trim(),
  );
}

export function isCrewTaskNodeFork(
  data: Record<string, unknown> | undefined | null,
): boolean {
  return Boolean(
    data &&
      typeof data === "object" &&
      (data as { crewTaskFork?: boolean }).crewTaskFork === true,
  );
}

export function isCrewTaskCanonicalWorkNode(
  taskCanvasNodeId: string | undefined,
  nodeId: string,
  data: Record<string, unknown> | undefined | null,
): boolean {
  return (
    Boolean(taskCanvasNodeId && taskCanvasNodeId === nodeId) &&
    !isCrewTaskNodeFork(data)
  );
}
