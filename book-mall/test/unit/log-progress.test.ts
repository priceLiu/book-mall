import { describe, expect, it } from "vitest";

import { isGatewayLogTerminalStatus } from "@/lib/gateway/log-progress";

describe("log-progress", () => {
  it("treats SUCCEEDED/FAILED/CANCELLED as terminal", () => {
    expect(isGatewayLogTerminalStatus("SUCCEEDED")).toBe(true);
    expect(isGatewayLogTerminalStatus("FAILED")).toBe(true);
    expect(isGatewayLogTerminalStatus("CANCELLED")).toBe(true);
  });

  it("allows progress writes only for non-terminal statuses", () => {
    expect(isGatewayLogTerminalStatus("RUNNING")).toBe(false);
    expect(isGatewayLogTerminalStatus("PENDING")).toBe(false);
    expect(isGatewayLogTerminalStatus(null)).toBe(false);
    expect(isGatewayLogTerminalStatus(undefined)).toBe(false);
  });
});
