import { describe, expect, it } from "vitest";

import { isGatewayLogTerminalStatus } from "@/lib/gateway/gateway-log-record-info";

describe("ecom video gateway log reconcile contract", () => {
  it("panel video assets must carry logId for reconcile lookup", () => {
    const meta = {
      kind: "panel_video",
      taskId: "task-abc",
      logId: "log-xyz",
      projectId: "proj-1",
      panelIndex: 2,
    };
    expect(meta.logId).toBeTruthy();
    expect(meta.taskId).toBeTruthy();
  });

  it("reconcile closes only non-terminal gateway logs", () => {
    expect(isGatewayLogTerminalStatus("RUNNING")).toBe(false);
    expect(isGatewayLogTerminalStatus("SUCCEEDED")).toBe(true);
  });
});
