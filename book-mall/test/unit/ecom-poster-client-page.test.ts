import { describe, expect, it } from "vitest";

import { posterGatewayClientPage } from "@/lib/ecom/ecom-poster-client-page";

describe("posterGatewayClientPage", () => {
  it("uses stable project id in clientPage path", () => {
    expect(posterGatewayClientPage("user-1", "proj-abc", "generate")).toBe(
      "ecom/user-1/proj-abc/ecom-toolkit__poster__generate",
    );
    expect(posterGatewayClientPage("user-1", "proj-abc", "batch-generate")).toContain(
      "__batch-generate",
    );
  });
});
