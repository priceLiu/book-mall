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

import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  uploadEcomTemplateGalleryItem,
} from "@/lib/ecom-template-gallery-api";
import {
  reconcileImportItemAfterUploadLoss,
  reconcileImportJobItemsOnce,
} from "@/lib/ecom-template-gallery/import-reconcile";
import {
  hasResumableItems,
  hasUnfinishedItems,
  jobStats,
  loadPersistedImportJobs,
  mergeReconciledImportItems,
  normalizeStalledImportJobs,
  savePersistedImportJobs,
  stopPersistedImportJob,
  UPLOAD_IN_FLIGHT_GRACE_MS,
  type PersistedImportItem,
  type PersistedImportJob,
} from "@/lib/ecom-template-gallery/import-storage";
import type { EcomTemplateGalleryEntry } from "@/lib/ecom-template-gallery/types";

/** 并行上传路数 */
const UPLOAD_CONCURRENCY = 3;
/** 失败后重新排队上传的最大次数（不含首次尝试） */
const MAX_UPLOAD_RETRIES = 3;
/** 重试基础等待（指数退避） */
const RETRY_BASE_DELAY_MS = 1500;
/** 与服务端 maxDuration 对齐；单条大图导入约 3～6 分钟 */
const UPLOAD_CLIENT_TIMEOUT_MS = 420_000;
const IN_FLIGHT_POLL_MS = 3000;
/** 无 runner 时自动恢复间隔 */
const RUNNER_WATCHDOG_MS = 4000;

function mergeJobSnapshot(
  stored: PersistedImportJob[],
  memory: PersistedImportJob[],
  jobId: string,
): PersistedImportJob[] {
  const storedJob = stored.find((j) => j.id === jobId);
  const memJob = memory.find((j) => j.id === jobId);
  if (!storedJob) return stored;
  if (!memJob) return stored;

  const mergedItems = storedJob.items.map((storedItem) => {
    const memItem = memJob.items.find((m) => m.id === storedItem.id);
    if (!memItem) return storedItem;
    if (memItem.status === "uploading") return memItem;
    if (
      storedItem.status === "skipped" ||
      storedItem.status === "success" ||
      storedItem.status === "failed" ||
      storedItem.status === "cancelled"
    ) {
      return storedItem;
    }
    return memItem;
  });

  return stored.map((j) =>
    j.id === jobId ? { ...storedJob, items: mergedItems, done: false } : j,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * 仅「浏览器 ↔ BFF ↔ 主站」链路中断：请求可能仍在服务端处理，重发会重复上传，
 * 须挂起等 catalog 核对。主站已返回的业务失败（如源站拉取失败）不属于此类，
 * 必须重新排队，否则条目会停在 uploading 直到 grace 过期。
 */
function isLikelyTransportError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("upstream_fetch_failed") ||
    m.includes("failed to fetch") ||
    m.includes("load failed") ||
    m.includes("networkerror") ||
    m.includes("无法连接主站")
  );
}

async function recoverAfterUploadResponseLoss(
  job: PersistedImportJob,
  itemId: string,
  onEntry?: (entry: EcomTemplateGalleryEntry) => void,
): Promise<{ synced: boolean; items?: PersistedImportItem[] }> {
  const quick = await reconcileImportJobItemsOnce(job, {
    itemIds: new Set([itemId]),
    onEntry,
  });
  if (quick.synced > 0) {
    return { synced: true, items: quick.items };
  }
  const category = job.items.find((it) => it.id === itemId)?.category;
  const synced = await reconcileImportItemAfterUploadLoss(
    itemId,
    category,
    onEntry,
  );
  return { synced };
}

function formatUploadError(raw: string): string {
  if (raw === "upstream_fetch_failed") {
    return "无法连接主站，请确认 book-mall 已启动";
  }
  if (raw === "fetch failed") {
    return "源站拉取失败，稍后自动重试";
  }
  return raw;
}

type EnqueueInput = Omit<
  PersistedImportItem,
  "status" | "progress" | "error"
>;

type EcomTemplateImportContextValue = {
  jobs: PersistedImportJob[];
  activeJob: PersistedImportJob | null;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  enqueueUpload: (items: EnqueueInput[]) => string;
  resumeJob: (jobId: string) => void;
  stopJob: (jobId: string) => void;
  clearFinishedJobs: () => void;
  onEntryUploaded?: (entry: EcomTemplateGalleryEntry) => void;
  setOnEntryUploaded: (fn: ((entry: EcomTemplateGalleryEntry) => void) | undefined) => void;
};

const EcomTemplateImportContext =
  createContext<EcomTemplateImportContextValue | null>(null);

export function useEcomTemplateImport() {
  const ctx = useContext(EcomTemplateImportContext);
  if (!ctx) {
    throw new Error("useEcomTemplateImport must be used within EcomTemplateImportProvider");
  }
  return ctx;
}

export function EcomTemplateImportProvider({ children }: { children: ReactNode }) {
  const { alert } = useDialogs();
  const [jobs, setJobs] = useState<PersistedImportJob[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const onEntryRef = useRef<((entry: EcomTemplateGalleryEntry) => void) | undefined>();
  const runningRef = useRef<Set<string>>(new Set());
  const cancelledRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Map<string, Set<AbortController>>>(new Map());
  const runJobRef = useRef<(jobId: string) => void>(() => {});
  const jobsRef = useRef<PersistedImportJob[]>([]);

  const registerAbortController = useCallback(
    (jobId: string, controller: AbortController) => {
      const set = abortControllersRef.current.get(jobId) ?? new Set();
      set.add(controller);
      abortControllersRef.current.set(jobId, set);
    },
    [],
  );

  const unregisterAbortController = useCallback(
    (jobId: string, controller: AbortController) => {
      abortControllersRef.current.get(jobId)?.delete(controller);
    },
    [],
  );

  const abortInFlightUploads = useCallback((jobId: string) => {
    for (const controller of abortControllersRef.current.get(jobId) ?? []) {
      controller.abort();
    }
    abortControllersRef.current.delete(jobId);
  }, []);

  const persist = useCallback((next: PersistedImportJob[]) => {
    jobsRef.current = next;
    setJobs(next);
    savePersistedImportJobs(next);
  }, []);

  const setOnEntryUploaded = useCallback(
    (fn: ((entry: EcomTemplateGalleryEntry) => void) | undefined) => {
      onEntryRef.current = fn;
    },
    [],
  );

  const runJob = useCallback(
    async (jobId: string) => {
      if (runningRef.current.has(jobId)) return;
      runningRef.current.add(jobId);

      try {
        let snapshot = normalizeStalledImportJobs(loadPersistedImportJobs());
        let job = snapshot.find((j) => j.id === jobId);
        if (!job) return;

        snapshot = snapshot.map((j) =>
          j.id === jobId ? { ...j, done: false, notified: false } : j,
        );
        persist(snapshot);

        const patchItem = (
          itemId: string,
          patch: Partial<PersistedImportItem>,
        ) => {
          snapshot = snapshot.map((j) => {
            if (j.id !== jobId) return j;
            return {
              ...j,
              items: j.items.map((it) =>
                it.id === itemId ? { ...it, ...patch } : it,
              ),
            };
          });
          job = snapshot.find((j) => j.id === jobId);
          persist(snapshot);
        };

        const applyReconciledItems = (reconciledItems: PersistedImportItem[]) => {
          const currentItems =
            snapshot.find((j) => j.id === jobId)?.items ?? [];
          const merged = mergeReconciledImportItems(
            currentItems,
            reconciledItems,
          );
          snapshot = snapshot.map((j) =>
            j.id === jobId ? { ...j, items: merged } : j,
          );
          job = snapshot.find((j) => j.id === jobId);
          persist(snapshot);
        };

        // entry 为空表示「已确认在库、条目稍后由核对异步补上」，同样算完成
        const applyCatalogEntry = (
          itemId: string,
          entry: EcomTemplateGalleryEntry | null,
          opts?: { alreadyExists?: boolean },
        ) => {
          patchItem(itemId, {
            status: opts?.alreadyExists ? "skipped" : "success",
            progress: 100,
            error: undefined,
            retryCount: 0,
            uploadStartedAt: undefined,
          });
          if (entry) onEntryRef.current?.(entry);
        };

        // 启动前快速核对（不阻塞过久）；已落库条目直接跳过
        job = snapshot.find((j) => j.id === jobId);
        if (job) {
          const reconciled = await reconcileImportJobItemsOnce(job, {
            onEntry: (entry) => onEntryRef.current?.(entry),
          });
          if (reconciled.synced > 0) {
            applyReconciledItems(reconciled.items);
          }
          // 刷新/HMR 中断在「核对落库 96%」的条目：先核对，未命中则重新排队
          const staleReconcile = job?.items.filter(
            (it) => it.status === "uploading" && (it.progress ?? 0) >= 90,
          );
          if (staleReconcile && staleReconcile.length > 0) {
            for (const stale of staleReconcile) {
              const recovered = await recoverAfterUploadResponseLoss(
                job!,
                stale.id,
                (entry) => onEntryRef.current?.(entry),
              );
              if (recovered.items) {
                applyReconciledItems(recovered.items);
              } else if (recovered.synced) {
                applyCatalogEntry(stale.id, null);
              } else {
                patchItem(stale.id, {
                  status: "queued",
                  progress: 0,
                  uploadStartedAt: undefined,
                  error: undefined,
                });
              }
            }
          }
        }

        const uploadingIds = new Set<string>();

        const uploadOne = async (item: PersistedImportItem) => {
          if (cancelledRef.current.has(jobId)) return;

          const currentItem = snapshot
            .find((j) => j.id === jobId)
            ?.items.find((it) => it.id === item.id);
          if (currentItem && currentItem.status !== "queued") return;

          const retryCount = currentItem?.retryCount ?? item.retryCount ?? 0;
          if (retryCount > 0) {
            const delayMs = Math.min(
              15_000,
              RETRY_BASE_DELAY_MS * 2 ** (retryCount - 1),
            );
            patchItem(item.id, {
              status: "uploading",
              progress: 4,
              error: undefined,
              uploadStartedAt: undefined,
            });
            uploadingIds.add(item.id);
            await sleep(delayMs);
            uploadingIds.delete(item.id);
            if (cancelledRef.current.has(jobId)) return;
          }

          uploadingIds.add(item.id);
          const uploadStartedAt = Date.now();
          patchItem(item.id, {
            status: "uploading",
            progress: 10,
            error: undefined,
            uploadStartedAt,
          });

          const controller = new AbortController();
          let timedOut = false;
          const timeoutTimer = window.setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, UPLOAD_CLIENT_TIMEOUT_MS);
          registerAbortController(jobId, controller);

          try {
            const result = await uploadEcomTemplateGalleryItem(
              {
                category: item.category,
                mediaKind: item.mediaKind,
                id: item.id,
                sourceUrl: item.sourceUrl,
                title: item.title,
                hot: item.hot,
                ext: item.ext,
                posterUrl: item.posterUrl,
                thumbSourceUrl: item.thumbSourceUrl,
              },
              { signal: controller.signal },
            );

            if (cancelledRef.current.has(jobId)) {
              patchItem(item.id, {
                status: "cancelled",
                progress: 0,
                error: "已手动停止",
              });
              return;
            }

            if (result.status === "failed") {
              const quick = await reconcileImportJobItemsOnce(
                snapshot.find((j) => j.id === jobId)!,
                {
                  itemIds: new Set([item.id]),
                  onEntry: (entry) => onEntryRef.current?.(entry),
                },
              );
              if (quick.synced > 0) {
                applyReconciledItems(quick.items);
                return;
              }

              const existing = await reconcileImportItemAfterUploadLoss(
                item.id,
                item.category,
                (entry) => onEntryRef.current?.(entry),
              );
              if (existing) {
                applyCatalogEntry(item.id, null);
                return;
              }

              const friendlyError = formatUploadError(result.error);
              if (isLikelyTransportError(result.error)) {
                patchItem(item.id, {
                  status: "uploading",
                  uploadStartedAt: uploadStartedAt ?? Date.now(),
                  error: undefined,
                });
                return;
              }

              const nextRetry = retryCount + 1;
              if (nextRetry <= MAX_UPLOAD_RETRIES) {
                patchItem(item.id, {
                  status: "queued",
                  progress: 0,
                  retryCount: nextRetry,
                  error: `${friendlyError}（排队重试 ${nextRetry}/${MAX_UPLOAD_RETRIES}）`,
                });
              } else {
                patchItem(item.id, {
                  status: "failed",
                  progress: 100,
                  retryCount: nextRetry,
                  error: friendlyError,
                });
              }
              return;
            }

            const status = result.status === "skipped" ? "skipped" : "success";
            patchItem(item.id, {
              status,
              progress: 100,
              error: undefined,
              retryCount: 0,
              uploadStartedAt: undefined,
            });
            if (result.entry) {
              onEntryRef.current?.(result.entry);
            }
          } catch (e) {
            if (
              cancelledRef.current.has(jobId) ||
              (controller.signal.aborted && !timedOut)
            ) {
              patchItem(item.id, {
                status: "cancelled",
                progress: 0,
                error: "已手动停止",
              });
              return;
            }

            const message = timedOut
              ? "上传超时，等待服务端确认"
              : formatUploadError(e instanceof Error ? e.message : "上传失败");

            const quick = await reconcileImportJobItemsOnce(
              snapshot.find((j) => j.id === jobId)!,
              {
                itemIds: new Set([item.id]),
                onEntry: (entry) => onEntryRef.current?.(entry),
              },
            );
            if (quick.synced > 0) {
              applyReconciledItems(quick.items);
              return;
            }

            const existing = await reconcileImportItemAfterUploadLoss(
              item.id,
              item.category,
              (entry) => onEntryRef.current?.(entry),
            );
            if (existing) {
              applyCatalogEntry(item.id, null);
              return;
            }

            // 超时后服务端仍可能在 maxDuration 内完成，重发会重复上传
            if (timedOut || isLikelyTransportError(message)) {
              patchItem(item.id, {
                status: "uploading",
                uploadStartedAt: uploadStartedAt ?? Date.now(),
                error: undefined,
              });
              return;
            }

            const nextRetry = retryCount + 1;
            if (nextRetry <= MAX_UPLOAD_RETRIES) {
              patchItem(item.id, {
                status: "queued",
                progress: 0,
                retryCount: nextRetry,
                error: `${message}（排队重试 ${nextRetry}/${MAX_UPLOAD_RETRIES}）`,
              });
            } else {
              patchItem(item.id, {
                status: "failed",
                progress: 100,
                retryCount: nextRetry,
                error: message,
              });
            }
          } finally {
            uploadingIds.delete(item.id);
            window.clearTimeout(timeoutTimer);
            unregisterAbortController(jobId, controller);
          }
        };

        while (true) {
          if (cancelledRef.current.has(jobId)) break;

          snapshot = mergeJobSnapshot(loadPersistedImportJobs(), snapshot, jobId);
          job = snapshot.find((j) => j.id === jobId);
          if (!job) break;

          const targets = job.items.filter((i) => i.status === "queued");

          const graceUploading = job.items.filter(
            (i) =>
              i.status === "uploading" &&
              !uploadingIds.has(i.id) &&
              i.uploadStartedAt != null &&
              Date.now() - i.uploadStartedAt < UPLOAD_IN_FLIGHT_GRACE_MS,
          );
          if (graceUploading.length > 0) {
            const reconciled = await reconcileImportJobItemsOnce(job, {
              onEntry: (entry) => onEntryRef.current?.(entry),
              itemIds: new Set(graceUploading.map((i) => i.id)),
            });
            if (reconciled.synced > 0) {
              applyReconciledItems(reconciled.items);
              continue;
            }
            // 还有待上传条目时不阻塞整队列，仅无 queued 时才等待服务端
            if (targets.length === 0) {
              await sleep(IN_FLIGHT_POLL_MS);
              continue;
            }
          }

          if (targets.length === 0) break;

          const batch = targets.slice(0, UPLOAD_CONCURRENCY);
          await Promise.all(batch.map((item) => uploadOne(item)));
        }

        if (cancelledRef.current.has(jobId)) {
          snapshot = stopPersistedImportJob(snapshot, jobId);
          persist(snapshot);
          return;
        }

        job = snapshot.find((j) => j.id === jobId);
        const finalStats = job ? jobStats(job.items) : null;
        const isFullyComplete = finalStats ? finalStats.pending === 0 : true;

        snapshot = snapshot.map((j) => {
          if (j.id !== jobId) return j;
          return { ...j, done: isFullyComplete };
        });
        persist(snapshot);

        const finished = snapshot.find((j) => j.id === jobId);
        if (finished && isFullyComplete && !finished.notified) {
          const s = jobStats(finished.items);

          snapshot = snapshot.map((j) =>
            j.id === jobId ? { ...j, notified: true } : j,
          );
          persist(snapshot);

          const parts = [
            `成功 ${s.success}`,
            s.skipped > 0 ? `已存在 ${s.skipped}` : null,
            s.failed > 0 ? `失败 ${s.failed}` : null,
            s.cancelled > 0 ? `已停止 ${s.cancelled}` : null,
          ].filter(Boolean);

          void alert({
            title: "模板导入完成",
            message: `共 ${s.total} 项：${parts.join("，")}`,
            variant: s.failed > 0 ? "error" : "default",
          });
        }
      } catch (e) {
        console.error("[ecom-template-import] runJob failed", e);
        const next = normalizeStalledImportJobs(loadPersistedImportJobs()).map(
          (j) => (j.id === jobId ? { ...j, done: false } : j),
        );
        persist(next);
      } finally {
        runningRef.current.delete(jobId);
      }
    },
    [alert, persist, abortInFlightUploads, registerAbortController, unregisterAbortController],
  );

  runJobRef.current = (jobId: string) => {
    void runJob(jobId);
  };

  useEffect(() => {
    let disposed = false;

    void (async () => {
      const normalized = normalizeStalledImportJobs(loadPersistedImportJobs());
      let kickoff = normalized.map((j) =>
        !j.cancelled && hasResumableItems(j) && j.done
          ? { ...j, done: false, notified: false }
          : j,
      );

      // 快速核对不阻塞 runJob 过久
      await Promise.all(
        kickoff.map(async (job) => {
          if (job.cancelled || !hasResumableItems(job)) return job;
          const result = await reconcileImportJobItemsOnce(job, {
            onEntry: (entry) => onEntryRef.current?.(entry),
          });
          return result.synced > 0 ? { ...job, items: result.items } : job;
        }),
      ).then((updated) => {
        kickoff = updated;
      });

      if (disposed) return;

      setJobs(kickoff);
      savePersistedImportJobs(kickoff);

      const incomplete = kickoff.filter(
        (j) => !j.cancelled && hasResumableItems(j),
      );
      const latest = incomplete[incomplete.length - 1];
      if (latest) {
        setPanelOpen(true);
        runJobRef.current(latest.id);
      }
    })();

    return () => {
      disposed = true;
    };
  }, []);

  // 有排队项但 runner 未工作时自动拉起（如刷新后 done 误标、runJob 异常退出）
  // 手动停止但仍有未落库条目的任务也要留在面板里，否则无从点「继续导入」
  const activeJob = useMemo(() => {
    const list = jobs.filter((j) =>
      j.cancelled ? hasUnfinishedItems(j) : !j.done || hasResumableItems(j),
    );
    return list[list.length - 1] ?? null;
  }, [jobs]);

  useEffect(() => {
    if (!activeJob || activeJob.cancelled) return;
    const { pending } = jobStats(activeJob.items);
    if (pending === 0) return;
    if (runningRef.current.has(activeJob.id)) return;
    runJobRef.current(activeJob.id);
  }, [activeJob]);

  // 看门狗：pending 存在但 runner 停住时自动拉起
  useEffect(() => {
    if (!activeJob || activeJob.cancelled) return;

    const timer = window.setInterval(() => {
      const job = loadPersistedImportJobs().find((j) => j.id === activeJob.id);
      if (!job || job.cancelled) return;
      const { pending } = jobStats(job.items);
      if (pending === 0) return;
      if (runningRef.current.has(activeJob.id)) return;
      runJobRef.current(activeJob.id);
    }, RUNNER_WATCHDOG_MS);

    return () => window.clearInterval(timer);
  }, [activeJob]);

  useEffect(() => {
    if (!activeJob || activeJob.cancelled) return;

    const hasUnfinished = activeJob.items.some(
      (i) =>
        i.status !== "success" &&
        i.status !== "skipped" &&
        i.status !== "cancelled",
    );
    if (!hasUnfinished) return;

    let disposed = false;

    const syncFromCatalog = async () => {
      if (disposed) return;
      const memJob = jobsRef.current.find((j) => j.id === activeJob.id);
      const storedJobs = loadPersistedImportJobs();
      const storedJob = storedJobs.find((j) => j.id === activeJob.id);
      const job = memJob ?? storedJob;
      if (!job || job.cancelled) return;

      const result = await reconcileImportJobItemsOnce(job, {
        onEntry: (entry) => onEntryRef.current?.(entry),
      });
      if (disposed || result.synced === 0) return;

      const mergedItems = mergeReconciledImportItems(
        memJob?.items ?? job.items,
        result.items,
      );
      const stats = jobStats(mergedItems);
      const next = (memJob ? jobsRef.current : storedJobs).map((j) =>
        j.id === activeJob.id
          ? {
              ...j,
              items: mergedItems,
              done: false,
            }
          : j,
      );
      persist(next);

      if (stats.pending > 0 && !runningRef.current.has(activeJob.id)) {
        runJobRef.current(activeJob.id);
      }
    };

    void syncFromCatalog();
    const timer = window.setInterval(() => void syncFromCatalog(), 15000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeJob, persist]);

  const enqueueUpload = useCallback(
    (items: EnqueueInput[]) => {
      const jobId = `job-${Date.now()}`;
      const job: PersistedImportJob = {
        id: jobId,
        createdAt: Date.now(),
        done: false,
        notified: false,
        items: items.map((it) => ({
          ...it,
          status: "queued" as const,
          progress: 0,
        })),
      };
      const next = [...loadPersistedImportJobs(), job];
      persist(next);
      setPanelOpen(true);
      void runJob(jobId);
      return jobId;
    },
    [persist, runJob],
  );

  const stopJob = useCallback(
    (jobId: string) => {
      cancelledRef.current.add(jobId);
      abortInFlightUploads(jobId);
      const next = stopPersistedImportJob(loadPersistedImportJobs(), jobId);
      persist(next);
      runningRef.current.delete(jobId);
    },
    [abortInFlightUploads, persist],
  );

  const resumeJob = useCallback(
    (jobId: string) => {
      cancelledRef.current.delete(jobId);
      const list = loadPersistedImportJobs().map((j) =>
        j.id === jobId
          ? {
              ...j,
              // 不清 cancelled，看门狗与刷新恢复都会跳过它，续传只能跑一轮
              cancelled: false,
              done: false,
              notified: false,
              items: j.items.map((it) =>
                it.status === "failed" ||
                it.status === "cancelled" ||
                it.status === "uploading" ||
                (it.status === "queued" && (it.retryCount ?? 0) > 0)
                  ? {
                      ...it,
                      status: "queued" as const,
                      progress: 0,
                      retryCount: 0,
                      error: undefined,
                    }
                  : it,
              ),
            }
          : j,
      );
      persist(list);
      setPanelOpen(true);
      void runJob(jobId);
    },
    [persist, runJob],
  );

  const clearFinishedJobs = useCallback(() => {
    const next = loadPersistedImportJobs().filter(
      (j) => (!j.done || hasResumableItems(j)) && !j.cancelled,
    );
    persist(next);
  }, [persist]);

  const value = useMemo(
    () => ({
      jobs,
      activeJob,
      panelOpen,
      setPanelOpen,
      enqueueUpload,
      resumeJob,
      stopJob,
      clearFinishedJobs,
      setOnEntryUploaded,
    }),
    [
      jobs,
      activeJob,
      panelOpen,
      enqueueUpload,
      resumeJob,
      stopJob,
      clearFinishedJobs,
      setOnEntryUploaded,
    ],
  );

  return (
    <EcomTemplateImportContext.Provider value={value}>
      {children}
    </EcomTemplateImportContext.Provider>
  );
}
