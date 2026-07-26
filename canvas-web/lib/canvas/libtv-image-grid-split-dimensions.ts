/** 宫格切分 · 列/行尺寸（纯函数，供单测与 UI 共用） */

export type LibtvGridSplitPresetId = "2x2" | "3x3" | "4x4" | "5x5";

export type LibtvImageGridSplitState = {
  cols: number;
  rows: number;
  selected: number[];
};

export const LIBTV_GRID_SPLIT_PRESETS: {
  id: LibtvGridSplitPresetId;
  label: string;
  cols: number;
  rows: number;
}[] = [
  { id: "2x2", label: "4宫格 (2×2)", cols: 2, rows: 2 },
  { id: "3x3", label: "9宫格 (3×3)", cols: 3, rows: 3 },
  { id: "4x4", label: "16宫格 (4×4)", cols: 4, rows: 4 },
  { id: "5x5", label: "25宫格 (5×5)", cols: 5, rows: 5 },
];

export const LIBTV_GRID_SPLIT_MIN = 1;
export const LIBTV_GRID_SPLIT_MAX = 12;

export function libtvGridSplitFromDimensions(
  cols: number,
  rows: number,
): LibtvImageGridSplitState | null {
  const c = Math.floor(Number(cols));
  const r = Math.floor(Number(rows));
  if (
    !Number.isFinite(c) ||
    !Number.isFinite(r) ||
    c < LIBTV_GRID_SPLIT_MIN ||
    r < LIBTV_GRID_SPLIT_MIN ||
    c > LIBTV_GRID_SPLIT_MAX ||
    r > LIBTV_GRID_SPLIT_MAX
  ) {
    return null;
  }
  return { cols: c, rows: r, selected: [] };
}

export function libtvGridSplitFromPreset(
  presetId: LibtvGridSplitPresetId,
): LibtvImageGridSplitState {
  const preset = LIBTV_GRID_SPLIT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return { cols: 3, rows: 3, selected: [] };
  return libtvGridSplitFromDimensions(preset.cols, preset.rows)!;
}

export function toggleGridSplitCell(
  state: LibtvImageGridSplitState,
  cellIndex: number,
): LibtvImageGridSplitState {
  const selected = state.selected.includes(cellIndex)
    ? state.selected.filter((i) => i !== cellIndex)
    : [...state.selected, cellIndex].sort((a, b) => a - b);
  return { ...state, selected };
}
