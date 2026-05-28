type CanvasNotifyFn = (args: {
  title: string;
  message: string;
  variant?: "info" | "error";
}) => void;

let notifier: CanvasNotifyFn | null = null;

export function registerCanvasNotifier(fn: CanvasNotifyFn | null): void {
  notifier = fn;
}

export function canvasNotify(args: {
  title: string;
  message: string;
  variant?: "info" | "error";
}): void {
  notifier?.(args);
}
