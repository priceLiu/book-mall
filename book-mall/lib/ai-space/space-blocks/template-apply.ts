/**
 * 套用整页版式的排版计算（纯函数，便于单测）
 *
 * 早期实现按「下标」把已有块塞进模板槽位：第 3 个块必然占第 3 个槽位。
 * 但槽位是按类型设计的（标题槽只有 2 行高、封面槽 6 行高），
 * 把一张图放进标题槽会按图片自己的 maxH 长回 6 行，直接压到下一个槽位上——
 * 这就是「杂志封面 / 作品集套用后版面错乱」的根因。
 *
 * 现在改为：
 *  1. **按块类型配对**：已有块只认领同类型槽位（图配图、标题配标题）；
 *  2. 认领不到的已有块按原顺序追加到版式下方，保持默认档位；
 *  3. 没被认领的槽位补建为空槽位，等用户从素材抽屉填；
 *  4. 最后统一做一次 **无重叠回流**，几何合法时零位移，非法时向下顺延。
 */

import {
  resolveTierLayout,
  SPACE_GRID_COLS,
  type SpaceSizeTierKey,
} from "./size-tiers";
import {
  buildTemplateBlocks,
  type SpacePageTemplateKey,
} from "./page-templates";
import { SPACE_BLOCKS, type SpaceBlockType } from "./types";

export type TemplateApplyExistingBlock = {
  id: string;
  blockType: SpaceBlockType;
};

export type TemplateApplyPlacement = {
  /** 已有块的 id；null 表示该槽位需新建 */
  id: string | null;
  blockType: SpaceBlockType;
  sizeTier: SpaceSizeTierKey;
  layoutX: number;
  layoutY: number;
  layoutW: number;
  layoutH: number;
  mobileOrder: number;
  /** 仅新建槽位带模板预设的 config / content */
  config: Record<string, unknown> | null;
  content: { text: string } | null;
};

type Draft = Omit<TemplateApplyPlacement, "mobileOrder">;

function geometry(
  blockType: SpaceBlockType,
  desired: SpaceSizeTierKey,
): { sizeTier: SpaceSizeTierKey; w: number; h: number } {
  const def = SPACE_BLOCKS[blockType];
  const sizeTier = def.allowedTiers.includes(desired) ? desired : def.defaultTier;
  const { w, h } = resolveTierLayout(sizeTier, def.maxH);
  return { sizeTier, w, h };
}

/** 逐块寻找不与已占用格子相交的落点：x 固定，y 只向下顺延 */
function reflow(drafts: Draft[]): Draft[] {
  const ordered = [...drafts].sort(
    (a, b) => a.layoutY - b.layoutY || a.layoutX - b.layoutX,
  );
  const taken = new Set<string>();
  const cell = (x: number, y: number) => `${x}:${y}`;

  const fits = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        if (taken.has(cell(x + dx, y + dy))) return false;
      }
    }
    return true;
  };

  const occupy = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) taken.add(cell(x + dx, y + dy));
    }
  };

  for (const d of ordered) {
    const x = Math.max(0, Math.min(d.layoutX, SPACE_GRID_COLS - d.layoutW));
    let y = Math.max(0, d.layoutY);
    while (!fits(x, y, d.layoutW, d.layoutH)) y += 1;
    d.layoutX = x;
    d.layoutY = y;
    occupy(x, y, d.layoutW, d.layoutH);
  }

  return ordered;
}

export function planTemplateApply(
  key: SpacePageTemplateKey,
  existing: TemplateApplyExistingBlock[],
): TemplateApplyPlacement[] {
  const slots = buildTemplateBlocks(key);

  // 同类型槽位队列：先出现的槽位先被认领
  const byType = new Map<SpaceBlockType, number[]>();
  slots.forEach((s, i) => {
    const list = byType.get(s.blockType);
    if (list) list.push(i);
    else byType.set(s.blockType, [i]);
  });

  const claimedBy = new Map<number, TemplateApplyExistingBlock>();
  const tail: TemplateApplyExistingBlock[] = [];

  for (const block of existing) {
    const queue = byType.get(block.blockType);
    const slotIndex = queue?.shift();
    if (slotIndex === undefined) tail.push(block);
    else claimedBy.set(slotIndex, block);
  }

  const drafts: Draft[] = slots.map((slot, i) => {
    const owner = claimedBy.get(i);
    const blockType = owner?.blockType ?? slot.blockType;
    const { sizeTier, w, h } = geometry(blockType, slot.sizeTier);
    return {
      id: owner?.id ?? null,
      blockType,
      sizeTier,
      layoutX: slot.layoutX,
      layoutY: slot.layoutY,
      layoutW: w,
      layoutH: h,
      // 已有块保留自己的 config / content，只有新建槽位取模板预设
      config: owner ? null : slot.config,
      content: owner ? null : slot.content,
    };
  });

  // 追加块排在版式下方，单列铺开
  let tailY = drafts.reduce((max, d) => Math.max(max, d.layoutY + d.layoutH), 0);
  for (const block of tail) {
    const def = SPACE_BLOCKS[block.blockType];
    const { sizeTier, w, h } = geometry(block.blockType, def.defaultTier);
    drafts.push({
      id: block.id,
      blockType: block.blockType,
      sizeTier,
      layoutX: 0,
      layoutY: tailY,
      layoutW: w,
      layoutH: h,
      config: null,
      content: null,
    });
    tailY += h;
  }

  return reflow(drafts).map((d, i) => ({ ...d, mobileOrder: i }));
}
