"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AiSpaceComposeTaskDto } from "@/lib/ai-space/ai-space-compose-types";

import { isComposeTaskRunning } from "./ai-space-compose-progress-ui";

const COMPOSE_API = "/api/platform/v1/ai-space/compose-tasks";
const RETRY_API = "/api/platform/v1/ai-space/compose-tasks/retry";
const POLL_MS = 5_000;

type AiSpaceComposeTasksContextValue = {
  tasks: AiSpaceComposeTaskDto[];
  refresh: () => Promise<void>;
  addTask: (task: AiSpaceComposeTaskDto) => void;
  retryTask: (taskId: string) => Promise<AiSpaceComposeTaskDto>;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  runningCount: number;
};

const AiSpaceComposeTasksContext = createContext<AiSpaceComposeTasksContextValue | null>(
  null,
);

export function AiSpaceComposeTasksProvider({
  initialTasks,
  children,
}: {
  initialTasks: AiSpaceComposeTaskDto[];
  children: ReactNode;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [panelOpen, setPanelOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(COMPOSE_API, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        tasks?: AiSpaceComposeTaskDto[];
        error?: string;
      };
      if (!res.ok) return;
      if (data.tasks) setTasks(data.tasks);
    } catch {
      // 轮询 / 刷新时网络抖动或服务重启：保留上次任务列表，勿打断整页
    }
  }, []);

  const addTask = useCallback((task: AiSpaceComposeTaskDto) => {
    setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)]);
    setPanelOpen(true);
  }, []);

  const retryTask = useCallback(async (taskId: string) => {
    const res = await fetch(RETRY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: taskId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      task?: AiSpaceComposeTaskDto;
      error?: string;
    };
    if (!res.ok || !data.task) {
      throw new Error(data.error ?? "重试失败");
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task! : t)));
    return data.task;
  }, []);

  const runningCount = useMemo(
    () => tasks.filter((t) => isComposeTaskRunning(t.status)).length,
    [tasks],
  );

  const hasRunning = runningCount > 0;

  useEffect(() => {
    if (!hasRunning) return;
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [hasRunning, refresh]);

  const value = useMemo(
    () => ({
      tasks,
      refresh,
      addTask,
      retryTask,
      panelOpen,
      setPanelOpen,
      runningCount,
    }),
    [tasks, refresh, addTask, retryTask, panelOpen, runningCount],
  );

  return (
    <AiSpaceComposeTasksContext.Provider value={value}>
      {children}
    </AiSpaceComposeTasksContext.Provider>
  );
}

export function useAiSpaceComposeTasks(): AiSpaceComposeTasksContextValue {
  const ctx = useContext(AiSpaceComposeTasksContext);
  if (!ctx) {
    throw new Error("useAiSpaceComposeTasks must be used within AiSpaceComposeTasksProvider");
  }
  return ctx;
}
