import { describe, expect, it } from "vitest";

import { resolveGenerateHandlerKind } from "@/lib/quick-replica/qr-generate-service";
import {
  defaultWorkspaceDraft,
  templateToWorkspaceDraft,
} from "@/lib/quick-replica/qr-template-service";
import { getBuiltinQrTemplateById } from "@/lib/quick-replica/builtin-templates";

describe("qr generate dispatch", () => {
  it("resolveGenerateHandlerKind 识别 motion-sync 族", () => {
    expect(resolveGenerateHandlerKind("motion-sync")).toBe("motion-sync");
    expect(resolveGenerateHandlerKind("lip-sync")).toBe("motion-sync");
    expect(resolveGenerateHandlerKind("text-to-video")).toBe("text-to-video");
  });

  it("defaultWorkspaceDraft 为 motion-sync 选择 motion-control 模型", () => {
    const draft = defaultWorkspaceDraft({
      category: "video",
      kind: "motion-sync",
      toolKey: "motion-sync",
    });
    expect(draft.modelKey).toContain("motion-control");
    expect(draft.category).toBe("video");
    expect(draft.kind).toBe("motion-sync");
  });

  it("templateToWorkspaceDraft 保留 slots 与 category/kind", () => {
    const t = getBuiltinQrTemplateById("builtin-video-motion-sync");
    expect(t).toBeTruthy();
    const draft = templateToWorkspaceDraft(t!);
    expect(draft.targetImageUrl).toBeTruthy();
    expect(draft.referenceVideoUrl).toBeTruthy();
    expect(draft.kind).toBe("motion-sync");
    expect(draft.category).toBe("video");
  });
});
