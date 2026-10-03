"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useBackgroundGeneration } from "@/components/generation";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  createIpWorkflowGenJobId,
  evaluateIpWorkflowGenPoll,
  ECOM_IP_WORKFLOW_MS_PER_SLOT,
  ECOM_IP_WORKFLOW_PROJECT_POLL_MS,
  ipWorkflowImageGenTaskId,
  ipWorkflowSlotHasImage,
  ipWorkflowSlotUiGenerating,
  pendingIpWorkflowSlotIndexes,
  withIpWorkflowStepGenerating,
  type IpWorkflowGenPollResult,
  type IpWorkflowSlotLike,
} from "@/lib/ecom-ip-workflow-image-gen-dock";

export type IpWorkflowGenJob<TStepId extends string = string> = {
  jobId: string;
  stepId: TStepId;
  indexes: number[];
  startedAt: string;
  taskId: string;
  stepLabel: string;
};

type StepGenFailure = { index: number; message: string };

type UseEcomIpWorkflowStepImageGenOptions<TStepId extends string, TProject> = {
  project: TProject;
  projectId: string;
  /** 切换项目时用于恢复服务端 generating */
  listImageSteps: Array<{ id: TStepId; kind: string; label: string }>;
  stepState: (project: TProject, stepId: TStepId) => {
    status: string;
    slots: IpWorkflowSlotLike[];
  };
  fetchProject: (id: string) => Promise<TProject>;
  generateStep: (input: {
    projectId: string;
    stepId: TStepId;
    indexes: number[];
    modelKey: string;
    imageSize?: string;
    concurrency: number;
  }) => Promise<{ generated: number; failures: StepGenFailure[]; project?: TProject }>;
  onProjectChange: () => void | Promise<void>;
  /** 轮询 / 生成响应里的 project 快照，直接写入 Studio 状态（避免只 refetch 仍读到旧 plan） */
  applyProject?: (project: TProject) => void | Promise<void>;
  imageGenConcurrencyLimit: number;
};

type JobRuntime = {
  settled: boolean;
  generated: number;
  failures: StepGenFailure[];
  fetchError: string | null;
};

export function useEcomIpWorkflowStepImageGen<TStepId extends string, TProject>(
  opts: UseEcomIpWorkflowStepImageGenOptions<TStepId, TProject>,
) {
  const {
    project,
    projectId,
    listImageSteps,
    stepState,
    fetchProject,
    generateStep,
    onProjectChange,
    applyProject,
    imageGenConcurrencyLimit,
  } = opts;

  const applyProjectRef = useRef(applyProject);
  applyProjectRef.current = applyProject;

  const backgroundGen = useBackgroundGeneration();
  const { alert, toast } = useDialogs();

  const [genJobs, setGenJobs] = useState<IpWorkflowGenJob<TStepId>[]>([]);
  const genJobsRef = useRef(genJobs);
  genJobsRef.current = genJobs;

  const runtimeRef = useRef<Map<string, JobRuntime>>(new Map());
  const genPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restoredRef = useRef<string | null>(null);
  const resolvedJobsRef = useRef<Set<string>>(new Set());
  const snapshotSeqRef = useRef(0);

  const applyFreshProject = useCallback(
    async (fresh: TProject) => {
      if (!applyProjectRef.current) {
        await onProjectChange();
        return;
      }
      await applyProjectRef.current(fresh);
    },
    [onProjectChange],
  );

  const stopGenPoll = useCallback(() => {
    if (genPollRef.current) {
      clearInterval(genPollRef.current);
      genPollRef.current = null;
    }
  }, []);

  const pullProjectSnapshot = useCallback(async () => {
    const seq = ++snapshotSeqRef.current;
    try {
      const fresh = await fetchProject(projectId);
      if (seq !== snapshotSeqRef.current) return;

      for (const job of genJobsRef.current) {
        const state = stepState(fresh, job.stepId);
        for (const index of job.indexes) {
          if (ipWorkflowSlotHasImage(state.slots, index)) {
            const rt = runtimeRef.current.get(job.jobId);
            if (rt) rt.generated = Math.max(rt.generated, 1);
          }
        }
      }

      await applyFreshProject(fresh);
    } catch {
      /* 轮询拉项目失败时不二次 refetch，避免 setInterval 里未捕获异常 */
    }
  }, [applyFreshProject, fetchProject, projectId, stepState]);

  const ensureGenPoll = useCallback(() => {
    if (genPollRef.current) return;
    void pullProjectSnapshot();
    genPollRef.current = setInterval(() => {
      void pullProjectSnapshot();
    }, ECOM_IP_WORKFLOW_PROJECT_POLL_MS);
  }, [pullProjectSnapshot]);

  const removeJob = useCallback(
    (jobId: string) => {
      setGenJobs((prev) => {
        const next = prev.filter((j) => j.jobId !== jobId);
        if (next.length === 0) stopGenPoll();
        return next;
      });
      runtimeRef.current.delete(jobId);
    },
    [stopGenPoll],
  );

  const pollJob = useCallback(
    (fresh: TProject, job: IpWorkflowGenJob<TStepId>): IpWorkflowGenPollResult => {
      const state = stepState(fresh, job.stepId);
      const runtime = runtimeRef.current.get(job.jobId);
      return evaluateIpWorkflowGenPoll({
        stepStatus: state.status,
        slots: state.slots,
        jobIndexes: job.indexes,
        settled: runtime?.settled ?? false,
        generated: runtime?.generated ?? 0,
        failures: runtime?.failures ?? [],
        fetchError: runtime?.fetchError ?? null,
      });
    },
    [stepState],
  );

  const finishJob = useCallback(
    async (
      job: IpWorkflowGenJob<TStepId>,
      stepLabel: string,
      outcome: IpWorkflowGenPollResult,
    ) => {
      if (resolvedJobsRef.current.has(job.jobId)) return;
      resolvedJobsRef.current.add(job.jobId);

      const runtime = runtimeRef.current.get(job.jobId);
      const total = job.indexes.length;

      try {
        await onProjectChange();
      } catch {
        /* 收尾 refetch 失败时保留当前内存态，避免 Next 红屏 */
      }
      removeJob(job.jobId);

      if (outcome.status === "succeeded") {
        backgroundGen.dismissTask(job.taskId);
        toast({
          title: `${stepLabel} 出图完成`,
          message: `共 ${runtime?.generated ?? total} 张，已写入项目并保存至「我的资产」。`,
          variant: "success",
        });
        return;
      }

      if (outcome.status === "failed") {
        backgroundGen.failTask(job.taskId, outcome.error);
        const failures = runtime?.failures ?? [];
        if (failures.length > 0) {
          await alert({
            title: `${stepLabel} 部分或全部失败`,
            message: failures.map((f) => `第 ${f.index} 张：${f.message}`).join("\n"),
            variant: "error",
          });
        } else {
          await alert({
            title: `${stepLabel} 生成失败`,
            message: outcome.error,
            variant: "error",
          });
        }
      }
    },
    [alert, backgroundGen, onProjectChange, removeJob, toast],
  );

  const registerDockTask = useCallback(
    (job: IpWorkflowGenJob<TStepId>, stepLabel: string, modelKey: string) => {
      const total = job.indexes.length;
      backgroundGen.registerTask({
        id: job.taskId,
        status: "running",
        minimized: false,
        showInDockFromStart: true,
        label:
          total === 1
            ? `出图 · ${stepLabel} 第 ${job.indexes[0]} 张`
            : `出图 · ${stepLabel}（${total} 张）`,
        hint: modelKey,
        startedAt: job.startedAt,
        expectedDurationMs: total * ECOM_IP_WORKFLOW_MS_PER_SLOT,
        poll: async () => {
          let fresh: TProject;
          try {
            fresh = await fetchProject(projectId);
          } catch {
            return { status: "running" as const };
          }
          await applyFreshProject(fresh);
          const outcome = pollJob(fresh, job);
          if (outcome.status === "running") {
            return {
              status: "running" as const,
              progressPercent: outcome.progressPercent,
              detail: outcome.detail,
            };
          }
          if (outcome.status === "succeeded") {
            return { status: "succeeded" as const };
          }
          return { status: "failed" as const, error: outcome.error };
        },
        onSucceeded: async () => {
          await finishJob(job, stepLabel, { status: "succeeded" });
        },
        onFailed: async () => {
          const fresh = await fetchProject(projectId).catch(() => project);
          const outcome = pollJob(fresh, job);
          if (outcome.status === "failed") {
            await finishJob(job, stepLabel, outcome);
          }
        },
      });
    },
    [applyFreshProject, backgroundGen, fetchProject, finishJob, pollJob, project, projectId],
  );

  const runGenerate = useCallback(
    (
      stepId: TStepId,
      indexes: number[],
      stepLabel: string,
      modelKey: string,
      imageSize?: string,
    ) => {
      if (indexes.length === 0) return;

      const sameStepBusy = genJobsRef.current.some((j) => {
        if (j.stepId !== stepId) return false;
        const rt = runtimeRef.current.get(j.jobId);
        return rt ? !rt.settled : true;
      });
      if (sameStepBusy) {
        void toast({
          title: "请稍候",
          message: `「${stepLabel}」上一批出图仍在进行或收尾中，请完成后再点下一批，避免槽位被跳过。`,
          variant: "default",
        });
        return;
      }

      const jobId = createIpWorkflowGenJobId(stepId);
      const startedAt = new Date().toISOString();
      const taskId = ipWorkflowImageGenTaskId(projectId, jobId);
      const job: IpWorkflowGenJob<TStepId> = {
        jobId,
        stepId,
        indexes,
        startedAt,
        taskId,
        stepLabel,
      };

      runtimeRef.current.set(jobId, {
        settled: false,
        generated: 0,
        failures: [],
        fetchError: null,
      });

      setGenJobs((prev) => [...prev, job]);
      ensureGenPoll();
      registerDockTask(job, stepLabel, modelKey);

      if (applyProjectRef.current) {
        void applyProjectRef.current(
          withIpWorkflowStepGenerating(project, stepId),
        );
      }

      void generateStep({
        projectId,
        stepId,
        indexes,
        modelKey,
        imageSize,
        concurrency: Math.max(1, Math.min(5, imageGenConcurrencyLimit)),
      })
        .then(async (result) => {
          const rt = runtimeRef.current.get(jobId);
          if (rt) {
            rt.generated = result.generated;
            rt.failures = result.failures;
          }
          if (result.project) {
            await applyFreshProject(result.project);
          } else {
            await pullProjectSnapshot();
          }
        })
        .catch((e) => {
          const rt = runtimeRef.current.get(jobId);
          const msg = e instanceof Error ? e.message : "生成失败";
          if (rt) {
            rt.fetchError = msg;
            if (rt.failures.length === 0) {
              rt.failures = indexes.map((index) => ({ index, message: msg }));
            }
          }
        })
        .finally(() => {
          const rt = runtimeRef.current.get(jobId);
          if (rt) rt.settled = true;
          void (async () => {
            await pullProjectSnapshot();
            let fresh: TProject;
            try {
              fresh = await fetchProject(projectId);
            } catch {
              return;
            }
            const outcome = pollJob(fresh, job);
            if (outcome.status !== "running") {
              await finishJob(job, stepLabel, outcome);
            }
          })();
        });
    },
    [
      ensureGenPoll,
      fetchProject,
      finishJob,
      generateStep,
      imageGenConcurrencyLimit,
      pollJob,
      project,
      projectId,
      pullProjectSnapshot,
      registerDockTask,
      toast,
    ],
  );

  const slotGeneratingFor = useCallback(
    (stepId: TStepId, index: number, liveProject: TProject) => {
      const state = stepState(liveProject, stepId);
      const job = genJobs.find(
        (j) => j.stepId === stepId && j.indexes.includes(index),
      );
      const rt = job ? runtimeRef.current.get(job.jobId) : undefined;
      return ipWorkflowSlotUiGenerating({
        stepStatus: state.status,
        slots: state.slots,
        index,
        indexInActiveJob: Boolean(job),
        localJobInFlight: Boolean(job && !rt?.settled),
      });
    },
    [genJobs, stepState],
  );

  const hasActiveGenJobs = genJobs.length > 0;

  /** 项目刷新后：槽位已出图 / 批次结束 → 与本地 job 对齐 */
  useEffect(() => {
    for (const job of [...genJobsRef.current]) {
      if (resolvedJobsRef.current.has(job.jobId)) continue;
      const state = stepState(project, job.stepId);
      const pending = pendingIpWorkflowSlotIndexes(state.slots, job.indexes);

      if (pending.length > 0 && pending.length < job.indexes.length) {
        setGenJobs((prev) =>
          prev.map((j) => {
            if (j.jobId !== job.jobId) return j;
            if (
              j.indexes.length === pending.length &&
              j.indexes.every((idx, i) => idx === pending[i])
            ) {
              return j;
            }
            return { ...j, indexes: pending };
          }),
        );
      }

      if (pending.length === 0) {
        const rt = runtimeRef.current.get(job.jobId);
        void finishJob(job, job.stepLabel, {
          status: "succeeded",
        });
        if (rt && !rt.settled) {
          rt.settled = true;
          rt.generated = Math.max(rt.generated, job.indexes.length);
        }
        continue;
      }

      if (state.status !== "generating") {
        const rt = runtimeRef.current.get(job.jobId);
        const outcome = pollJob(project, job);
        if (outcome.status !== "running") {
          void finishJob(job, job.stepLabel, outcome);
        } else if (rt?.settled && pending.length > 0) {
          void finishJob(job, job.stepLabel, {
            status: "failed",
            error: `${pending.length} 张未出图，请重试或刷新项目`,
          });
        }
      }
    }
  }, [backgroundGen, finishJob, pollJob, project, removeJob, stepState]);

  /** 刷新 / 重进项目：恢复服务端 marking generating 的槽位 */
  useEffect(() => {
    if (restoredRef.current === projectId) return;
    restoredRef.current = projectId;
    setGenJobs([]);
    runtimeRef.current.clear();
    resolvedJobsRef.current.clear();
    stopGenPoll();

    for (const step of listImageSteps) {
      if (step.kind === "compose") continue;
      const state = stepState(project, step.id);
      if (state.status !== "generating") continue;
      const pending = pendingIpWorkflowSlotIndexes(
        state.slots,
        state.slots.map((s) => s.index),
      );
      if (pending.length === 0) continue;

      const jobId = createIpWorkflowGenJobId(step.id);
      const job: IpWorkflowGenJob<TStepId> = {
        jobId,
        stepId: step.id,
        indexes: pending,
        startedAt: new Date().toISOString(),
        taskId: ipWorkflowImageGenTaskId(projectId, jobId),
        stepLabel: step.label,
      };
      runtimeRef.current.set(jobId, {
        settled: false,
        generated: 0,
        failures: [],
        fetchError: null,
      });
      setGenJobs((prev) => [...prev, job]);
      ensureGenPoll();

      if (
        !backgroundGen.tasks.some(
          (t) => t.id === job.taskId && t.status === "running",
        )
      ) {
        registerDockTask(job, step.label, "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- project.id only
  }, [projectId]);

  useEffect(
    () => () => {
      stopGenPoll();
    },
    [stopGenPoll],
  );

  return {
    genJobs,
    hasActiveGenJobs,
    runGenerate,
    slotGeneratingFor,
  };
}
