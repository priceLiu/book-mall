const INFLIGHT = new Set(["pending", "running", "PENDING", "SUBMITTED", "QUEUED", "DISPATCHING"]);

export function isCanvasInflightStatus(status?: string): boolean {
  return Boolean(status && INFLIGHT.has(status));
}
