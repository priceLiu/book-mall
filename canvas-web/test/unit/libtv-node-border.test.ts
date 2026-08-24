import { describe, expect, it } from "vitest";

import {
  LIBTV_NODE_BORDER_DEFAULT_WIDTH,
  LIBTV_NODE_BORDER_SELECTED_RING_OUTSET,
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";

describe("libtvNodeBorderStyle", () => {
  it("does not change border on hover", () => {
    const idle = libtvNodeBorderStyle({});
    const hover = libtvNodeBorderStyle({ hovered: true });
    expect(hover).toEqual(idle);
  });

  it("shows outward ring when selected", () => {
    const selected = libtvNodeBorderStyle({ selected: true, edition: "pro2" });
    expect(selected.borderWidth).toBe(LIBTV_NODE_BORDER_DEFAULT_WIDTH);
    expect(String(selected.boxShadow)).toContain(
      `0 0 0 ${LIBTV_NODE_BORDER_SELECTED_RING_OUTSET}px #FFFFFF`,
    );
  });

  it("uses cyan ring for sbv1 selection", () => {
    const selected = libtvNodeBorderStyle({ selected: true, edition: "sbv1" });
    expect(String(selected.boxShadow)).toContain("#22d3ee");
  });
});
