import type { CanvasTaskRecord } from "@/lib/canvas-api";

export type CompareReferenceImage = {
  id: string;
  url: string;
  label: string;
};

export type CompareSideOption = {
  id: string;
  label: string;
  url: string;
};

export function taskSideId(taskId: string) {
  return `task:${taskId}`;
}

export function refSideId(refId: string) {
  return `ref:${refId}`;
}

export function buildSideOptions(
  tasks: CanvasTaskRecord[],
  refs: CompareReferenceImage[],
): CompareSideOption[] {
  const refOpts = refs.map((r) => ({
    id: refSideId(r.id),
    label: r.label,
    url: r.url,
  }));
  const taskOpts = tasks
    .filter((t) => t.status === "SUCCEEDED" && t.ossUrl)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((t) => ({
      id: taskSideId(t.id),
      label: `${new Date(t.createdAt).toLocaleString()} · ${t.id.slice(-6)}`,
      url: t.ossUrl!,
    }));
  return [...refOpts, ...taskOpts];
}

export function defaultCompareSides(
  options: CompareSideOption[],
  defaultLeftId?: string,
  defaultRightId?: string,
  focusTaskId?: string,
  hasProductMain?: boolean,
): { leftId: string; rightId: string } {
  if (defaultLeftId && defaultRightId) {
    return { leftId: defaultLeftId, rightId: defaultRightId };
  }

  const rightId = focusTaskId
    ? taskSideId(focusTaskId)
    : options[options.length - 1]?.id ?? "";

  const rightIdx = options.findIndex((o) => o.id === rightId);
  const leftCandidate = rightIdx > 0 ? options[rightIdx - 1] : null;
  const mainRef = options.find((o) => o.id.startsWith("ref:"));

  if (leftCandidate) {
    return { leftId: leftCandidate.id, rightId };
  }
  if (mainRef && rightId) {
    return { leftId: mainRef.id, rightId };
  }
  if (options.length >= 2) {
    return { leftId: options[0]!.id, rightId: options[1]!.id };
  }
  if (hasProductMain && mainRef) {
    return { leftId: mainRef.id, rightId: rightId || mainRef.id };
  }
  return {
    leftId: options[0]?.id ?? "",
    rightId: options[1]?.id ?? options[0]?.id ?? "",
  };
}

export type MediaCompareContext = {
  tasks: CanvasTaskRecord[];
  referenceImages?: CompareReferenceImage[];
  /** 当前预览图对应的 task id */
  focusTaskId?: string;
  defaultLeftId?: string;
  defaultRightId?: string;
};

export function canShowCompare(context: MediaCompareContext): boolean {
  const options = buildSideOptions(
    context.tasks,
    context.referenceImages ?? [],
  );
  return options.length >= 2;
}
