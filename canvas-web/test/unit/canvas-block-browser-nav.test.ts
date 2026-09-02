import { afterEach, describe, expect, it } from "vitest";

import {
  CANVAS_EDITOR_PAGE_HTML_ATTR,
  CANVAS_SITE_NAV_BLOCK_HTML_ATTR,
  isCanvasBrowserNavMouseButton,
  isCanvasEditorPageNavBlockActive,
  isCanvasNavBlockActive,
  shouldBlockCanvasBrowserNavMouse,
} from "@/lib/canvas/canvas-block-browser-nav";

describe("canvas-block-browser-nav", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(CANVAS_EDITOR_PAGE_HTML_ATTR);
    document.documentElement.removeAttribute(CANVAS_SITE_NAV_BLOCK_HTML_ATTR);
    document.querySelectorAll("[data-canvas-editor]").forEach((el) => {
      el.removeAttribute("data-canvas-editor");
    });
  });

  it("detects browser back/forward mouse buttons", () => {
    expect(isCanvasBrowserNavMouseButton(3)).toBe(true);
    expect(isCanvasBrowserNavMouseButton(4)).toBe(true);
    expect(isCanvasBrowserNavMouseButton(0)).toBe(false);
  });

  it("blocks side buttons on entire canvas editor page", () => {
    document.documentElement.setAttribute(CANVAS_EDITOR_PAGE_HTML_ATTR, "");
    expect(isCanvasNavBlockActive()).toBe(true);
    expect(isCanvasEditorPageNavBlockActive()).toBe(true);

    const event = {
      button: 3,
      target: document.body,
    } as MouseEvent;
    expect(shouldBlockCanvasBrowserNavMouse(event)).toBe(true);
  });

  it("blocks side buttons site-wide when site nav guard is active", () => {
    document.documentElement.setAttribute(CANVAS_SITE_NAV_BLOCK_HTML_ATTR, "");
    expect(isCanvasNavBlockActive()).toBe(true);

    const event = {
      button: 4,
      target: document.body,
    } as MouseEvent;
    expect(shouldBlockCanvasBrowserNavMouse(event)).toBe(true);
  });

  it("blocks side buttons on body portals when editor root exists", () => {
    const editor = document.createElement("div");
    editor.setAttribute("data-canvas-editor", "");
    document.body.appendChild(editor);

    const event = {
      button: 4,
      target: document.body,
    } as MouseEvent;
    expect(shouldBlockCanvasBrowserNavMouse(event)).toBe(true);

    editor.remove();
  });
});
