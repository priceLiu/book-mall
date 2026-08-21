import { describe, expect, it } from "vitest";

import {
  LIBTV_NODE_BORDER_DEFAULT_WIDTH,
  LIBTV_NODE_BORDER_HOVER_OUTSET,
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";

describe("libtvNodeBorderStyle", () => {
  it("keeps layout border width on hover and grows the ring outward", () => {
    const idle = libtvNodeBorderStyle({});
    const hover = libtvNodeBorderStyle({ hovered: true });
    expect(idle.borderWidth).toBe(LIBTV_NODE_BORDER_DEFAULT_WIDTH);
    expect(hover.borderWidth).toBe(LIBTV_NODE_BORDER_DEFAULT_WIDTH);
    expect(String(hover.boxShadow)).toContain(
      `0 0 0 ${LIBTV_NODE_BORDER_HOVER_OUTSET}px #FFFFFF`,
    );
  });
});
