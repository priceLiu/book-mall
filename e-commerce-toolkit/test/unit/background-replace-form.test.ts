import { describe, expect, it } from "vitest";

import {
  DEFAULT_BACKGROUND_REPLACE_FORM,
  canSubmitBackgroundReplace,
} from "@/lib/background-replace-types";

describe("canSubmitBackgroundReplace", () => {
  it("defaults to Seedream and requires a scene prompt", () => {
    expect(DEFAULT_BACKGROUND_REPLACE_FORM.modelKey).toBe("doubao-seedream-5-0-pro");
    expect(canSubmitBackgroundReplace(DEFAULT_BACKGROUND_REPLACE_FORM, true)).toBe(
      false,
    );
    expect(
      canSubmitBackgroundReplace(
        { ...DEFAULT_BACKGROUND_REPLACE_FORM, refPrompt: "cafe" },
        false,
      ),
    ).toBe(false);
    expect(
      canSubmitBackgroundReplace(
        { ...DEFAULT_BACKGROUND_REPLACE_FORM, refPrompt: "cafe" },
        true,
      ),
    ).toBe(true);
  });

  it("lets Wanx submit with only a guide image", () => {
    expect(
      canSubmitBackgroundReplace(
        {
          ...DEFAULT_BACKGROUND_REPLACE_FORM,
          modelKey: "wanx-background-generation-v2",
          refImageUrl: "https://example.com/style.jpg",
        },
        true,
      ),
    ).toBe(true);
  });
});
