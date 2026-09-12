"use client";

import { useCallback, useState } from "react";

import { VtonRefineGenderDialog } from "@/components/vton/vton-refine-gender-dialog";
import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import type { VtonTryonRefinerGender } from "@/lib/vton-types";

type AlertFn = (opts: {
  title: string;
  message: string;
  variant?: "default" | "error";
}) => Promise<void>;

type ToastFn = (opts: {
  title: string;
  message?: string;
  variant?: "default" | "success" | "error";
}) => void;

export type UseVtonTryonRefineOptions = {
  /** 上次选择的模特性别 */
  defaultGender?: VtonTryonRefinerGender;
  /** 为 true 时不允许发起精修（如批量试衣进行中） */
  blocked?: boolean;
  /** 执行精修：targetId 由调用方定义（试衣 resultId / 姿势 index 字符串等） */
  refine: (opts: {
    targetId: string;
    gender: VtonTryonRefinerGender;
  }) => Promise<void>;
  /** 精修成功后持久化 gender（如写入 project.settings） */
  onGenderPersist?: (gender: VtonTryonRefinerGender) => void;
  alert: AlertFn;
  toast: ToastFn;
  successTitle?: string;
  successMessage?: string;
};

/**
 * 试衣精修（aitryon-refiner）统一交互：性别弹层 + 进行中态 + 可重复调用。
 */
export function useVtonTryonRefine(opts: UseVtonTryonRefineOptions) {
  const [refiningTargetIds, setRefiningTargetIds] = useState<string[]>([]);
  const [promptTargetId, setPromptTargetId] = useState<string | null>(null);

  const isRefining = refiningTargetIds.length > 0;
  const refiningTargetIdSet = new Set(refiningTargetIds);

  const requestRefine = useCallback(
    async (targetId: string) => {
      if (opts.blocked || isRefining) return;
      setPromptTargetId(targetId);
    },
    [opts.blocked, isRefining],
  );

  const confirmRefine = useCallback(
    async (gender: VtonTryonRefinerGender) => {
      if (!promptTargetId) return;
      const targetId = promptTargetId;
      setPromptTargetId(null);
      setRefiningTargetIds((prev) => [...prev, targetId]);
      try {
        await opts.refine({ targetId, gender });
        opts.onGenderPersist?.(gender);
        opts.toast({
          title: opts.successTitle ?? "精修完成",
          message: opts.successMessage ?? "已追加新版本，可切换查看",
          variant: "success",
        });
      } catch (e) {
        await opts.alert({
          title: "精修失败",
          message: formatEcomTransportError(e),
          variant: "error",
        });
      } finally {
        setRefiningTargetIds((prev) => prev.filter((id) => id !== targetId));
      }
    },
    [opts, promptTargetId],
  );

  const refineGenderDialog = (
    <VtonRefineGenderDialog
      open={promptTargetId != null}
      defaultGender={opts.defaultGender}
      onClose={() => setPromptTargetId(null)}
      onConfirm={(gender) => void confirmRefine(gender)}
    />
  );

  return {
    refiningTargetIds,
    refiningTargetIdSet,
    isRefining,
    requestRefine,
    refineGenderDialog,
  };
}
