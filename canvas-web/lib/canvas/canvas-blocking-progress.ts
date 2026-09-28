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

/** 全屏阻断式进度层（不可关闭）；返回的函数用于结束 */
export function showCanvasBlockingProgress(
  progress: CanvasBlockingProgress,
): () => void {
  useCanvasBlockingProgressStore.setState({ progress });
  return () => {
    if (useCanvasBlockingProgressStore.getState().progress === progress) {
      useCanvasBlockingProgressStore.setState({ progress: null });
    }
  };
}
