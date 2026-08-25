import { describe, expect, it } from "vitest";

import {
  readVendorRequestIdFromJson,
  resolveGatewayLogVendorRequestId,
} from "@/lib/gateway/vendor-request-id";

describe("resolveGatewayLogVendorRequestId", () => {
  it("prefers stored vendorRequestId column", () => {
    expect(
      resolveGatewayLogVendorRequestId({
        vendorRequestId: "col-id",
        resultSummary: { request_id: "summary-id" },
      }),
    ).toBe("col-id");
  });

  it("falls back to resultSummary.request_id for DashScope async tasks", () => {
    expect(
      resolveGatewayLogVendorRequestId({
        vendorRequestId: null,
        resultSummary: { request_id: "d4e7660b-c933-9a0a-889e-fa8e629fbb86" },
      }),
    ).toBe("d4e7660b-c933-9a0a-889e-fa8e629fbb86");
  });

  it("falls back to failMessage text", () => {
    expect(
      resolveGatewayLogVendorRequestId({
        failMessage: "Upstream error Request ID: abc-123",
      }),
    ).toBe("abc-123");
  });
});

describe("readVendorRequestIdFromJson", () => {
  it("reads request_id from vendor JSON", () => {
    expect(
      readVendorRequestIdFromJson({ request_id: "rid-1", output: {} }),
    ).toBe("rid-1");
  });
});
