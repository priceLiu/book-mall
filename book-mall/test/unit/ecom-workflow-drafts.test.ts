import { describe, expect, it } from "vitest";

import { listEcomWorkflowDrafts } from "@/lib/ecom/ecom-workflow-drafts-service";

describe("listEcomWorkflowDrafts", () => {
  it("is exported", () => {
    expect(typeof listEcomWorkflowDrafts).toBe("function");
  });
});
