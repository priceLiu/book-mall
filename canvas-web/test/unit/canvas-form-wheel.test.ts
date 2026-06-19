import { describe, expect, it } from "vitest";

import {
  handleLibtvDockWheelScroll,
  isCanvasWheelScrollBlockTarget,
  isCanvasViewportWheelTarget,
  shouldBlockCanvasViewportWheel,
} from "@/lib/canvas/canvas-form-wheel";

describe("canvas-form-wheel · libtv dock", () => {
  it("does not block wheel on textarea inside input dock", () => {
    document.body.innerHTML = `
      <div data-libtv-input-dock>
        <div class="pro2-dock-scroll" data-canvas-wheel-scroll style="height:80px;overflow-y:auto">
          <div style="height:400px"></div>
          <textarea>long prompt</textarea>
        </div>
      </div>
    `;
    const ta = document.querySelector("textarea")!;
    expect(isCanvasWheelScrollBlockTarget(ta)).toBe(false);
    expect(isCanvasViewportWheelTarget(ta)).toBe(false);
    expect(shouldBlockCanvasViewportWheel({ target: ta } as WheelEvent)).toBe(
      false,
    );
  });

  it("still blocks wheel on standalone canvas textarea", () => {
    document.body.innerHTML = `<div class="react-flow"><textarea /></div>`;
    const ta = document.querySelector("textarea")!;
    expect(isCanvasWheelScrollBlockTarget(ta)).toBe(true);
    expect(isCanvasViewportWheelTarget(ta)).toBe(true);
  });

  it("scrolls overflowing dock textarea on wheel", () => {
    document.body.innerHTML = `
      <div data-libtv-input-dock>
        <textarea style="height:60px;overflow-y:auto;display:block;width:200px">a
b
c
d
e
f
g
h</textarea>
      </div>
    `;
    const ta = document.querySelector("textarea") as HTMLTextAreaElement;
    Object.defineProperty(ta, "clientHeight", { value: 60, configurable: true });
    Object.defineProperty(ta, "scrollHeight", { value: 160, configurable: true });

    const prevented = handleLibtvDockWheelScroll({
      target: ta,
      deltaY: 25,
      deltaX: 0,
      deltaMode: 0,
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as WheelEvent);

    expect(prevented).toBe(true);
    expect(ta.scrollTop).toBe(25);
  });

  it("scrolls pro2-dock-scroll when wheel over short textarea in tall shell", () => {
    document.body.innerHTML = `
      <div data-libtv-input-dock class="nowheel" style="display:flex;flex-direction:column;height:120px;overflow:hidden">
        <div class="pro2-dock-scroll" data-canvas-wheel-scroll style="height:0;flex:1;min-height:0;overflow-y:auto">
          <textarea style="height:200px;display:block">long prompt</textarea>
        </div>
      </div>
    `;
    const scrollEl = document.querySelector(".pro2-dock-scroll") as HTMLElement;
    const ta = document.querySelector("textarea")!;
    expect(scrollEl.scrollHeight).toBeGreaterThan(scrollEl.clientHeight);

    const prevented = handleLibtvDockWheelScroll({
      target: ta,
      deltaY: 40,
      deltaX: 0,
      deltaMode: 0,
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as WheelEvent);

    expect(prevented).toBe(true);
    expect(scrollEl.scrollTop).toBe(40);
  });

  it("chains wheel to canvas at scroll top when scrolling up", () => {
    document.body.innerHTML = `
      <div data-libtv-input-dock style="display:flex;flex-direction:column;height:120px;overflow:hidden">
        <div class="pro2-dock-scroll" style="height:0;flex:1;min-height:0;overflow-y:auto">
          <textarea style="height:200px">long prompt</textarea>
        </div>
      </div>
    `;
    const scrollEl = document.querySelector(".pro2-dock-scroll") as HTMLElement;
    const ta = document.querySelector("textarea")!;
    scrollEl.scrollTop = 0;

    const consumed = handleLibtvDockWheelScroll({
      target: ta,
      deltaY: -40,
      deltaX: 0,
      deltaMode: 0,
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as WheelEvent);

    expect(consumed).toBe(false);
    expect(scrollEl.scrollTop).toBe(0);
  });
});
