import { create } from "zustand";

export type CanvasBlockingProgress = {
  title: string;
  message?: string;
};

type CanvasBlockingProgressState = {
  progress: CanvasBlockingProgress | null;
};

export const useCanvasBlockingProgressStore =
  create<CanvasBlockingProgressState>(() => ({ progress: null }));

/** 全屏阻断式进度层（不可关闭）；再次调用即更新文案，结束须 hideCanvasBlockingProgress */
export function showCanvasBlockingProgress(
  progress: CanvasBlockingProgress,
): void {
  useCanvasBlockingProgressStore.setState({ progress });
}

export function hideCanvasBlockingProgress(): void {
  useCanvasBlockingProgressStore.setState({ progress: null });
}
