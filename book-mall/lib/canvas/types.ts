export type CanvasNodeRunStatus =
  | "idle"
  | "queued"
  | "pending"
  | "running"
  | "done"
  | "error";

export type CanvasNodeRuntime = {
  status: CanvasNodeRunStatus;
  taskId?: string;
  ossUrl?: string;
  ephemeralUrl?: string;
  posterUrl?: string;
  textOutput?: string;
  failCode?: string;
  failMessage?: string;
  dismissedFailTaskId?: string;
};

export type CanvasFlowNode = {
  id: string;
  type?: string;
  data: Record<string, unknown>;
};
