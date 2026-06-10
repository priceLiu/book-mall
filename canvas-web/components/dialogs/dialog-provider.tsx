"use client";

/**
 * 全站统一的轻量弹窗：取代 `window.confirm` / `window.alert` / `window.prompt`。
 *
 * 用法：
 *   const { confirm, alert, prompt, doubleConfirm } = useDialogs();
 *   if (!(await confirm({ title: "删除", message: "确认要删除吗？" }))) return;
 *
 * 设计：
 *   - Promise 化；不阻塞主线程
 *   - 同时只允许一个对话框（队列：第一个关闭后下一个才出现）
 *   - Esc 关闭（cancel）；点遮罩取消；Enter 确认
 *   - 与画布主题（暗紫）一致；danger 模式用红色按钮
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ConfirmOptions = {
  title?: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 危险操作：确认按钮变红 */
  danger?: boolean;
};

export type AlertOptions = {
  title?: ReactNode;
  message: ReactNode;
  okLabel?: string;
  /** 信息层级：默认 info；error 时图标变红，success 变绿 */
  variant?: "info" | "success" | "error" | "warning";
};

export type PromptOptions = {
  title?: ReactNode;
  message?: ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 输入校验：返回错误信息字符串则阻止确认；返回 null 通过 */
  validate?: (value: string) => string | null;
};

type DialogTask =
  | {
      kind: "confirm";
      opts: ConfirmOptions;
      resolve: (v: boolean) => void;
    }
  | {
      kind: "alert";
      opts: AlertOptions;
      resolve: () => void;
    }
  | {
      kind: "prompt";
      opts: PromptOptions;
      resolve: (v: string | null) => void;
    };

type DialogsCtx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  /**
   * 二次确认：常用于"删除带 OSS"的破坏性操作。第一步说明对象，
   * 第二步明确不可恢复并 default cancel。返回 true 仅当两步都确认。
   */
  doubleConfirm: (args: {
    first: ConfirmOptions;
    second: ConfirmOptions;
  }) => Promise<boolean>;
};

const Ctx = createContext<DialogsCtx | null>(null);

export function useDialogs(): DialogsCtx {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useDialogs must be used within <DialogProvider>");
  }
  return v;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogTask[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const enqueue = useCallback((task: DialogTask) => {
    setQueue((q) => [...q, task]);
  }, []);

  const dequeue = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  const confirm = useCallback<DialogsCtx["confirm"]>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        enqueue({ kind: "confirm", opts, resolve });
      }),
    [enqueue],
  );
  const alert = useCallback<DialogsCtx["alert"]>(
    (opts) =>
      new Promise<void>((resolve) => {
        enqueue({ kind: "alert", opts, resolve });
      }),
    [enqueue],
  );
  const prompt = useCallback<DialogsCtx["prompt"]>(
    (opts) =>
      new Promise<string | null>((resolve) => {
        enqueue({ kind: "prompt", opts, resolve });
      }),
    [enqueue],
  );
  const doubleConfirm = useCallback<DialogsCtx["doubleConfirm"]>(
    async ({ first, second }) => {
      if (!(await confirm(first))) return false;
      if (!(await confirm(second))) return false;
      return true;
    },
    [confirm],
  );

  const ctxValue = useMemo<DialogsCtx>(
    () => ({ confirm, alert, prompt, doubleConfirm }),
    [confirm, alert, prompt, doubleConfirm],
  );

  const current = queue[0];

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
      {current ? (
        <DialogModal
          key={`${current.kind}-${queue.length}`}
          task={current}
          onClose={dequeue}
        />
      ) : null}
    </Ctx.Provider>
  );
}

/** 当前对话框 modal */
function DialogModal({
  task,
  onClose,
}: {
  task: DialogTask;
  onClose: () => void;
}) {
  const finish = useCallback(
    (action: "confirm" | "cancel", value?: string) => {
      if (task.kind === "confirm") {
        task.resolve(action === "confirm");
      } else if (task.kind === "alert") {
        task.resolve();
      } else {
        task.resolve(action === "confirm" ? (value ?? "") : null);
      }
      onClose();
    },
    [task, onClose],
  );

  return (
    <DialogShell onCancel={() => finish("cancel")}>
      {task.kind === "confirm" ? (
        <ConfirmBody task={task} onFinish={finish} />
      ) : task.kind === "alert" ? (
        <AlertBody task={task} onFinish={finish} />
      ) : (
        <PromptBody task={task} onFinish={finish} />
      )}
    </DialogShell>
  );
}

/** 公共框架：遮罩 + 卡片 + Esc / 点遮罩取消 */
function DialogShell({
  onCancel,
  children,
}: {
  onCancel: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[min(90vw,420px)] overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface,#161427)] text-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function VariantIcon({ variant }: { variant?: AlertOptions["variant"] }) {
  const v = variant ?? "info";
  const cls =
    v === "error"
      ? "bg-red-500/20 text-red-300"
      : v === "success"
        ? "bg-emerald-500/20 text-emerald-300"
        : v === "warning"
          ? "bg-amber-500/20 text-amber-300"
          : "bg-[var(--canvas-accent)]/20 text-[var(--canvas-accent)]";
  const sym = v === "error" ? "!" : v === "success" ? "✓" : v === "warning" ? "!" : "i";
  return (
    <span
      className={`grid size-8 place-items-center rounded-full text-[14px] font-semibold ${cls}`}
      aria-hidden
    >
      {sym}
    </span>
  );
}

function ConfirmBody({
  task,
  onFinish,
}: {
  task: Extract<DialogTask, { kind: "confirm" }>;
  onFinish: (action: "confirm" | "cancel") => void;
}) {
  const opts = task.opts;
  return (
    <>
      <div className="flex items-start gap-3 px-5 py-4">
        <VariantIcon variant={opts.danger ? "error" : "warning"} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-white">
            {opts.title ?? "请确认"}
          </p>
          <div className="mt-1 break-words text-[12px] leading-relaxed text-white/75">
            {opts.message}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-white/5 bg-black/20 px-4 py-3">
        <button
          type="button"
          onClick={() => onFinish("cancel")}
          className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30 hover:text-white"
        >
          {opts.cancelLabel ?? "取消"}
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => onFinish("confirm")}
          onKeyDown={(e) => {
            if (e.key === "Enter") onFinish("confirm");
          }}
          className={
            opts.danger
              ? "rounded-md border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-[12px] font-medium text-red-100 hover:bg-red-500/25"
              : "rounded-md bg-[var(--canvas-accent,#a78bfa)] px-3 py-1.5 text-[12px] font-medium text-black hover:bg-[var(--canvas-accent-soft,#c4b5fd)] hover:text-white"
          }
        >
          {opts.confirmLabel ?? (opts.danger ? "确认删除" : "确认")}
        </button>
      </div>
    </>
  );
}

function AlertBody({
  task,
  onFinish,
}: {
  task: Extract<DialogTask, { kind: "alert" }>;
  onFinish: (action: "confirm" | "cancel") => void;
}) {
  const opts = task.opts;
  return (
    <>
      <div className="flex items-start gap-3 px-5 py-4">
        <VariantIcon variant={opts.variant} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-white">
            {opts.title ??
              (opts.variant === "error"
                ? "出错了"
                : opts.variant === "success"
                  ? "完成"
                  : "提示")}
          </p>
          <div className="mt-1 break-words text-[12px] leading-relaxed text-white/75">
            {opts.message}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-white/5 bg-black/20 px-4 py-3">
        <button
          type="button"
          autoFocus
          onClick={() => onFinish("confirm")}
          onKeyDown={(e) => {
            if (e.key === "Enter") onFinish("confirm");
          }}
          className="rounded-md bg-[var(--canvas-accent,#a78bfa)] px-3 py-1.5 text-[12px] font-medium text-black hover:bg-[var(--canvas-accent-soft,#c4b5fd)] hover:text-white"
        >
          {opts.okLabel ?? "我知道了"}
        </button>
      </div>
    </>
  );
}

function PromptBody({
  task,
  onFinish,
}: {
  task: Extract<DialogTask, { kind: "prompt" }>;
  onFinish: (action: "confirm" | "cancel", value?: string) => void;
}) {
  const opts = task.opts;
  const [value, setValue] = useState<string>(opts.defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const onSubmit = () => {
    if (opts.validate) {
      const err = opts.validate(value);
      if (err) {
        setError(err);
        return;
      }
    }
    onFinish("confirm", value);
  };

  return (
    <>
      <div className="px-5 py-4">
        <p className="text-[14px] font-medium text-white">
          {opts.title ?? "请输入"}
        </p>
        {opts.message ? (
          <div className="mt-1 break-words text-[12px] leading-relaxed text-white/75">
            {opts.message}
          </div>
        ) : null}
        {opts.label ? (
          <label className="mt-3 block text-[11px] uppercase tracking-wider text-[var(--canvas-muted,#9ca3af)]">
            {opts.label}
          </label>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={opts.placeholder}
          className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[12px] text-white placeholder:text-white/40 focus:border-[var(--canvas-accent,#a78bfa)] focus:outline-none"
        />
        {error ? (
          <p className="mt-1.5 text-[11px] text-red-300">{error}</p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-white/5 bg-black/20 px-4 py-3">
        <button
          type="button"
          onClick={() => onFinish("cancel")}
          className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30 hover:text-white"
        >
          {opts.cancelLabel ?? "取消"}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-md bg-[var(--canvas-accent,#a78bfa)] px-3 py-1.5 text-[12px] font-medium text-black hover:bg-[var(--canvas-accent-soft,#c4b5fd)] hover:text-white"
        >
          {opts.confirmLabel ?? "确认"}
        </button>
      </div>
    </>
  );
}
