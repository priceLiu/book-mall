import { describe, expect, it } from "vitest";

import {
  SPACE_PAGE_TEMPLATE_KEYS,
  buildTemplateBlocks,
} from "@/lib/ai-space/space-blocks/page-templates";
import { SPACE_GRID_COLS } from "@/lib/ai-space/space-blocks/size-tiers";
import {
  planTemplateApply,
  type TemplateApplyPlacement,
} from "@/lib/ai-space/space-blocks/template-apply";
import { SPACE_BLOCKS, type SpaceBlockType } from "@/lib/ai-space/space-blocks/types";

type Rect = { layoutX: number; layoutY: number; layoutW: number; layoutH: number };

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.layoutX < b.layoutX + b.layoutW &&
    b.layoutX < a.layoutX + a.layoutW &&
    a.layoutY < b.layoutY + b.layoutH &&
    b.layoutY < a.layoutY + a.layoutH
  );
}

function findOverlap(rects: Rect[]): [number, number] | null {
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      if (overlaps(rects[i], rects[j])) return [i, j];
    }
  }
  return null;
}

describe("整页版式模板骨架", () => {
  it.each(SPACE_PAGE_TEMPLATE_KEYS)("%s 的槽位本身不重叠且不越界", (key) => {
    const blocks = buildTemplateBlocks(key);
    expect(blocks.length).toBeGreaterThan(0);
    expect(findOverlap(blocks)).toBeNull();
    for (const b of blocks) {
      expect(b.layoutX).toBeGreaterThanOrEqual(0);
      expect(b.layoutX + b.layoutW).toBeLessThanOrEqual(SPACE_GRID_COLS);
    }
  });
});

describe("planTemplateApply", () => {
  const existingOf = (types: SpaceBlockType[]) =>
    types.map((blockType, i) => ({ id: `b${i}`, blockType }));

  it("空画布套用版式：完整补建槽位，几何与模板一致", () => {
    const plan = planTemplateApply("MAGAZINE", []);
    const slots = buildTemplateBlocks("MAGAZINE");
    expect(plan).toHaveLength(slots.length);
    expect(plan.every((p) => p.id === null)).toBe(true);
    expect(findOverlap(plan)).toBeNull();
  });

  /**
   * 回归：早期按下标配对，会把图片块塞进标题槽位（2 行高）后按图片 maxH 长回 6 行，
   * 压穿下方槽位 —— 「杂志封面 / 作品集套用后版面错乱」。
   */
  it.each(SPACE_PAGE_TEMPLATE_KEYS)(
    "%s 套用到类型顺序不一致的已有画布后仍不重叠",
    (key) => {
      const plan = planTemplateApply(
        key,
        existingOf([
          "image",
          "image",
          "video",
          "image",
          "audio",
          "heading",
          "gallery",
          "text",
        ]),
      );
      expect(findOverlap(plan)).toBeNull();
      for (const p of plan) {
        expect(p.layoutX + p.layoutW).toBeLessThanOrEqual(SPACE_GRID_COLS);
      }
    },
  );

  it("已有块只认领同类型槽位，认领不到的排到版式下方", () => {
    const plan = planTemplateApply("MAGAZINE", existingOf(["heading", "audio"]));
    const byId = new Map<string, TemplateApplyPlacement>(
      plan.flatMap((p) => (p.id ? [[p.id, p]] : [])),
    );

    const heading = byId.get("b0");
    const audio = byId.get("b1");
    expect(heading?.blockType).toBe("heading");
    expect(audio?.blockType).toBe("audio");

    // 标题占到模板的标题槽（通栏、受 maxH 夹紧）
    expect(heading?.layoutW).toBe(SPACE_GRID_COLS);
    expect(heading?.layoutH).toBe(SPACE_BLOCKS.heading.maxH);

    // 版式里没有音频槽 → 追加到所有槽位下方
    const slotBottom = buildTemplateBlocks("MAGAZINE").reduce(
      (max, s) => Math.max(max, s.layoutY + s.layoutH),
      0,
    );
    expect(audio?.layoutY).toBeGreaterThanOrEqual(slotBottom);
  });

  it("已有块不会被改成别的挂件类型，且一个块只出现一次", () => {
    const types: SpaceBlockType[] = ["image", "text", "gallery", "video"];
    const plan = planTemplateApply("PORTFOLIO", existingOf(types));
    const kept = plan.filter((p) => p.id !== null);
    expect(kept).toHaveLength(types.length);
    expect(new Set(kept.map((p) => p.id)).size).toBe(types.length);
    for (const p of kept) {
      const index = Number(p.id!.slice(1));
      expect(p.blockType).toBe(types[index]);
    }
  });

  it("mobileOrder 跟随阅读顺序（先上后左）", () => {
    const plan = planTemplateApply("BENTO", existingOf(["image", "video"]));
    const sorted = [...plan].sort(
      (a, b) => a.layoutY - b.layoutY || a.layoutX - b.layoutX,
    );
    expect(plan.map((p) => p.mobileOrder)).toEqual(sorted.map((p) => p.mobileOrder));
    expect(plan.map((p) => p.mobileOrder)).toEqual(plan.map((_, i) => i));
  });
});
