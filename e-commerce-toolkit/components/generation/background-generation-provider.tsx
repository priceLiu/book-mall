"use client";

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

import { BackgroundGenerationDock } from "@/components/generation/background-generation-dock";
import {
  BACKGROUND_DOCK_FOREGROUND_MS,
  BACKGROUND_DOCK_FOREGROUND_POLL_MS,
} from "@/lib/generation/background-generation-policy";
import type {
  BackgroundGenerationTask,
  RegisterBackgroundGenerationTaskInput,
} from "@/lib/generation/background-generation-types";

type BackgroundGenerationContextValue = {
  tasks: BackgroundGenerationTask[];
  registerTask: (input: RegisterBackgroundGenerationTaskInput) => void;
  minimizeTask: (id: string) => void;
  minimizeAll: () => void;
  dismissTask: (id: string) => void;
  failTask: (id: string, error: string) => void;
  expandDock: () => void;
  /** 是否存在前台 running 且未最小化的任务（用于 inline busy） */
  hasForegroundRunning: boolean;
  isTaskMinimized: (id: string) => boolean;
};

const BackgroundGenerationContext =
  createContext<BackgroundGenerationContextValue | null>(null);

export function useBackgroundGeneration(): BackgroundGenerationContextValue {
  const ctx = useContext(BackgroundGenerationContext);
  if (!ctx) {
    throw new Error(
      "useBackgroundGeneration must be used within BackgroundGenerationProvider",
    );
  }
  return ctx;
}

/** 可选 hook：Provider 未挂载时返回 null（测试/子树） */
export function useBackgroundGenerationOptional(): BackgroundGenerationContextValue | null {
  return useContext(BackgroundGenerationContext);
}

export function BackgroundGenerationProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<BackgroundGenerationTask[]>([]);
  const [dockExpanded, setDockExpanded] = useState(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const pollLockRef = useRef(false);

  const registerTask = useCallback((input: RegisterBackgroundGenerationTaskInput) => {
    setTasks((prev) => {
      const next: BackgroundGenerationTask = {
        ...input,
        status: input.status ?? "running",
        minimized: input.minimized ?? true,
      };
      const idx = prev.findIndex((t) => t.id === input.id);
      if (idx >= 0) {
        const copy = [...prev];
        const existing = copy[idx]!;
        copy[idx] = {
          ...existing,
          ...next,
          minimized: input.minimized ?? existing.minimized,
          status: input.status ?? existing.status,
          poll: input.poll,
          onCancel: input.onCancel ?? existing.onCancel,
          cancelLabel: input.cancelLabel ?? existing.cancelLabel,
          onSucceeded: input.onSucceeded ?? existing.onSucceeded,
          onFailed: input.onFailed ?? existing.onFailed,
        };
        return copy;
      }
      return [...prev, next];
    });
    // 新任务默认仅显示右下角胶囊，不自动展开面板
  }, []);

  const minimizeTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, minimized: true } : t)),
    );
    setDockExpanded(false);
  }, []);

  const minimizeAll = useCallback(() => {
    setTasks((prev) => prev.map((t) => ({ ...t, minimized: true })));
    setDockExpanded(false);
  }, []);

  const dismissTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const failTask = useCallback((id: string, error: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: "failed" as const, error, minimized: true }
          : t,
      ),
    );
    setDockExpanded(true);
  }, []);

  const expandDock = useCallback(() => setDockExpanded(true), []);

  // 前台 busy 超时 → 自动最小化
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTasks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (t.status !== "running" || t.minimized) return t;
          const age = now - new Date(t.startedAt).getTime();
          if (age >= BACKGROUND_DOCK_FOREGROUND_MS) {
            changed = true;
            return { ...t, minimized: true };
          }
          return t;
        });
        if (changed) setDockExpanded(false);
        return changed ? next : prev;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Dock 轮询（4s，与前台 busy 超时策略配套）
  useEffect(() => {
    const tick = async () => {
      if (pollLockRef.current) return;
      const running = tasksRef.current.filter((t) => t.status === "running");
      if (running.length === 0) return;
      pollLockRef.current = true;
      try {
        for (const task of running) {
          try {
            const result = await task.poll();
            if (result.status === "running") continue;
            if (result.status === "succeeded") {
              await task.onSucceeded?.();
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id
                    ? { ...t, status: "succeeded", minimized: true }
                    : t,
                ),
              );
              setDockExpanded(true);
            } else {
              await task.onFailed?.();
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id
                    ? {
                        ...t,
                        status: "failed",
                        error: result.error ?? "生成失败",
                        minimized: true,
                      }
                    : t,
                ),
              );
              setDockExpanded(true);
            }
          } catch (e) {
            /* 单次 poll 失败保留 running */
            void e;
          }
        }
      } finally {
        pollLockRef.current = false;
      }
    };
    void tick();
    const id = window.setInterval(
      () => void tick(),
      BACKGROUND_DOCK_FOREGROUND_POLL_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  const hasForegroundRunning = useMemo(
    () => tasks.some((t) => t.status === "running" && !t.minimized),
    [tasks],
  );

  const isTaskMinimized = useCallback(
    (id: string) => tasks.find((t) => t.id === id)?.minimized ?? false,
    [tasks],
  );

  const value = useMemo(
    () => ({
      tasks,
      registerTask,
      minimizeTask,
      minimizeAll,
      dismissTask,
      failTask,
      expandDock,
      hasForegroundRunning,
      isTaskMinimized,
    }),
    [
      tasks,
      registerTask,
      minimizeTask,
      minimizeAll,
      dismissTask,
      failTask,
      expandDock,
      hasForegroundRunning,
      isTaskMinimized,
    ],
  );

  return (
    <BackgroundGenerationContext.Provider value={value}>
      {children}
      <BackgroundGenerationDock
        tasks={tasks}
        expanded={dockExpanded}
        onExpandedChange={setDockExpanded}
        onDismiss={dismissTask}
      />
    </BackgroundGenerationContext.Provider>
  );
}
