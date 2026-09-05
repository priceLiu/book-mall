/** book-mall 侧任务记录子集（供 hub runtime 对齐 canvas-web） */
export type CanvasTaskRecord = {
  id: string;
  nodeId?: string;
  status:
    | "QUEUED"
    | "DISPATCHING"
    | "PENDING"
    | "SUBMITTED"
    | "SUCCEEDED"
    | "FAILED"
    | "CANCELLED";
};
