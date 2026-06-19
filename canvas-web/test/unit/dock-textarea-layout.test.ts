import { describe, expect, it } from "vitest";

import {
  scrollDockToShowCaret,
  syncTextareaAutoHeight,
} from "@/lib/canvas/dock-textarea-layout";

describe("dock-textarea-layout", () => {
  it("syncTextareaAutoHeight preserves pro2-dock-scroll scrollTop", () => {
    document.body.innerHTML = `
      <div data-libtv-input-dock>
        <div class="pro2-dock-scroll" style="height:80px;overflow-y:auto">
          <textarea style="width:200px">line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8</textarea>
        </div>
      </div>
    `;
    const dockScroll = document.querySelector(".pro2-dock-scroll") as HTMLElement;
    const ta = document.querySelector("textarea") as HTMLTextAreaElement;

    syncTextareaAutoHeight(ta);
    dockScroll.scrollTop = 48;
    const before = dockScroll.scrollTop;

    syncTextareaAutoHeight(ta);
    expect(dockScroll.scrollTop).toBe(before);
  });

  it("scrollDockToShowCaret scrolls down when caret below viewport", () => {
    document.body.innerHTML = `
      <div data-libtv-input-dock>
        <div class="pro2-dock-scroll" style="height:60px;overflow-y:auto;position:relative;top:100px">
          <textarea style="width:200px;height:240px">a\nb\nc\nd\ne\nf\ng\nh\ni\nj</textarea>
        </div>
      </div>
    `;
    const dockScroll = document.querySelector(".pro2-dock-scroll") as HTMLElement;
    const ta = document.querySelector("textarea") as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    dockScroll.scrollTop = 0;

    scrollDockToShowCaret(ta);
    expect(dockScroll.scrollTop).toBeGreaterThan(0);
  });
});
