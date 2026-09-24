import { describe, expect, it } from "vitest";

import {
  DEFAULT_BACKGROUND_REPLACE_FORM,
  canSubmitBackgroundReplace,
} from "@/lib/background-replace-types";

describe("canSubmitBackgroundReplace", () => {
  it("needs a subject and either prompt or guide image", () => {
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
    expect(
      canSubmitBackgroundReplace(
        {
          ...DEFAULT_BACKGROUND_REPLACE_FORM,
          refImageUrl: "https://example.com/style.jpg",
        },
        true,
      ),
    ).toBe(true);
  });
});
