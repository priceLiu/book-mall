import { describe, expect, it } from "vitest";

import {
  applyTagPlainStyleSpan,
  bodyToTagPlainEdit,
  tagPlainEditToBody,
} from "@/lib/canvas/libtv-tag-plain-edit";

describe("libtv-tag-plain-edit", () => {
  it("roundtrips body through plain layer without showing markers", () => {
    const body = "标题\n{{16px|#fbbf24}}亮点{{/}}文案";
    const { plain, spans } = bodyToTagPlainEdit(body);
    expect(plain).toBe("标题\n亮点文案");
    expect(spans).toHaveLength(1);
    expect(tagPlainEditToBody(plain, spans)).toBe(body);
  });

  it("applies color on plain selection", () => {
    const state = bodyToTagPlainEdit("你好世界");
    const start = 2;
    const end = 4;
    const result = applyTagPlainStyleSpan(state, start, end, { color: "#f87171" });
    const body = tagPlainEditToBody(result.plain, result.spans);
    expect(body).toBe("你好{{#f87171}}世界{{/}}");
  });
});
