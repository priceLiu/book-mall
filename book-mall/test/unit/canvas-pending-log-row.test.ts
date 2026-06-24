import { describe, expect, it } from "vitest";

import type { CanvasQueuedTaskRow } from "@/lib/canvas/canvas-queue-without-log";
import {
  buildCanvasPendingLogRow,
  buildCanvasPendingLogRows,
  dedupeCanvasPendingRows,
} from "@/lib/canvas/canvas-pending-log-row";

function task(overrides: Partial<CanvasQueuedTaskRow> = {}): CanvasQueuedTaskRow {
  return {
    id: "task-1",
    status: "QUEUED",
    projectId: "proj-1",
    projectName: "项目 A",
    nodeId: "node-1",
    model: "doubao-seedance",
    queuedAt: "2026-06-25T01:00:00.000Z",
    createdAt: "2026-06-25T00:59:58.000Z",
    dispatchAfter: null,
    waitMinutes: 0,
    payloadKind: "video-engine",
    actorUserId: "user-1",
    ...overrides,
  };
}

describe("buildCanvasPendingLogRow", () => {
  it("合成行 id 带 pending: 前缀，并保留真实 canvasTaskId 供去重", () => {
    const row = buildCanvasPendingLogRow(task());
    expect(row.id).toBe("pending:task-1");
    expect(row.canvasTaskId).toBe("task-1");
    expect(row.pending).toBe(true);
  });

  it("锚点用 queuedAt（无则回退 createdAt），submittedAt 占位为同一锚点", () => {
    const withQueued = buildCanvasPendingLogRow(task());
    expect(withQueued.canvasStartedAt).toBe("2026-06-25T01:00:00.000Z");
    expect(withQueued.submittedAt).toBe("2026-06-25T01:00:00.000Z");

    const noQueued = buildCanvasPendingLogRow(task({ queuedAt: null }));
    expect(noQueued.canvasStartedAt).toBe("2026-06-25T00:59:58.000Z");
  });

  it("未到厂商：无 externalTaskId / 厂商分阶段 / 费用，clientPage 指向画布项目", () => {
    const row = buildCanvasPendingLogRow(task());
    expect(row.externalTaskId).toBeNull();
    expect(row.durationMs).toBeNull();
    expect(row.completedAt).toBeNull();
    expect(row.estimatedVendorCostYuan).toBeNull();
    expect(row.providerKind).toBeNull();
    expect(row.clientSource).toBe("CANVAS");
    expect(row.clientPage).toBe("canvas/proj-1");
    expect(row.appTaskKind).toBe("canvas");
    expect(row.appTaskNodeId).toBe("node-1");
  });

  it("DISPATCHING 状态透传；其余归一化为 QUEUED", () => {
    expect(buildCanvasPendingLogRow(task({ status: "DISPATCHING" })).status).toBe(
      "DISPATCHING",
    );
    expect(buildCanvasPendingLogRow(task({ status: "QUEUED" })).status).toBe(
      "QUEUED",
    );
  });

  it("model 为空时回落为空串而非 null（满足 GatewayLogRow.model: string）", () => {
    expect(buildCanvasPendingLogRow(task({ model: null })).model).toBe("");
  });
});

describe("dedupeCanvasPendingRows", () => {
  const rows = buildCanvasPendingLogRows([
    task({ id: "a" }),
    task({ id: "b" }),
    task({ id: "c" }),
  ]);

  it("命中真实日志 taskId 的排队行被丢弃", () => {
    const kept = dedupeCanvasPendingRows(rows, ["b"]);
    expect(kept.map((r) => r.canvasTaskId)).toEqual(["a", "c"]);
  });

  it("空/无命中时原样返回", () => {
    expect(dedupeCanvasPendingRows(rows, [])).toHaveLength(3);
    expect(dedupeCanvasPendingRows(rows, [null, undefined, "  "])).toHaveLength(3);
    expect(dedupeCanvasPendingRows(rows, ["zzz"])).toHaveLength(3);
  });

  it("taskId 两侧空白被裁剪后匹配", () => {
    const kept = dedupeCanvasPendingRows(rows, ["  a  "]);
    expect(kept.map((r) => r.canvasTaskId)).toEqual(["b", "c"]);
  });
});
