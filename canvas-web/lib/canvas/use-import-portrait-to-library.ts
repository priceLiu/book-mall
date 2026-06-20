"use client";

import { useCallback, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasPortraitKind } from "@/lib/canvas/portrait-node-data";
import { buildPortraitAssetUri } from "@/lib/canvas/portrait-node-data";
import {
  fetchCanvasPortraitImportStatus,
  importCanvasRealPortrait,
  importCanvasVirtualPortrait,
} from "@/lib/canvas/portrait-import-api";
import {
  formatPortraitProjectAssetError,
  openPortraitImportProgress,
  patchPortraitImportProgress,
} from "@/lib/canvas/portrait-import-progress";
import { fetchSbv1PortraitLivenessStatus } from "@/lib/canvas/sbv1-portrait-liveness-api";
import { savePortraitToProjectAssets } from "@/lib/canvas/save-portrait-project-asset";

export type UseImportPortraitOptions = {
  nodeId: string;
  edition: "sbv1" | "pro2";
  projectId?: string;
  imageUrl?: string;
  portraitKind?: CanvasPortraitKind;
  onNeedLiveness?: () => void;
};

export function useImportPortraitToLibrary(opts: UseImportPortraitOptions) {
  const base = useBookMallBaseUrl();
  const { alert, confirm, doubleConfirm } = useDialogs();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [importing, setImporting] = useState(false);

  const importPortrait = useCallback(async () => {
    if (!base) {
      await alert({
        title: "无法入库",
        message: "Book 主站未连接，请刷新页面后重试。",
        variant: "error",
      });
      return;
    }
    const node = useCanvasStore.getState().nodes.find((n) => n.id === opts.nodeId);
    const d = (node?.data ?? {}) as Record<string, unknown>;
    if (d.uploading) {
      await alert({
        title: "无法入库",
        message: "图片仍在上传中，请稍候再试。",
        variant: "warning",
      });
      return;
    }
    const imageUrl = opts.imageUrl?.trim() ?? "";
    if (!/^https:\/\//.test(imageUrl)) {
      await alert({
        title: "无法入库",
        message: "请等待图片上传完成（须为 HTTPS OSS 地址）后再入库。",
        variant: "warning",
      });
      return;
    }
    if (d.portraitStatus === "active" && d.portraitAssetUri) {
      const ok = await doubleConfirm({
        first: {
          title: "重新入库人像",
          message:
            "该图片已入库火山私域人像库。重新提交将创建新素材，是否继续？",
          confirmLabel: "继续",
        },
        second: {
          title: "确认重新入库",
          message: "重新入库不可撤销旧素材引用关系，确认继续？",
          confirmLabel: "确认重新入库",
          danger: true,
        },
      });
      if (!ok) return;
    }

    const kind: CanvasPortraitKind =
      opts.portraitKind ??
      ((await confirm({
        title: "私域人像入库",
        message:
          "选择入库类型：虚拟人像（AI/虚构角色，无需活体认证）或真人人像（须先完成 H5 活体认证）。",
        confirmLabel: "虚拟人像",
        cancelLabel: "真人人像",
      }))
        ? "virtual"
        : "real");

    if (kind === "real") {
      try {
        const status = await fetchSbv1PortraitLivenessStatus(base);
        if (!status.verified || !status.groupId) {
          const go = await confirm({
            title: "需要先完成真人认证",
            message:
              "真人人像入库须先完成 H5 活体认证。是否现在打开认证流程？",
            confirmLabel: "去认证",
          });
          if (go) opts.onNeedLiveness?.();
          return;
        }
      } catch (e) {
        await alert({
          title: "认证状态不可用",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
        return;
      }
    }

    setImporting(true);
    openPortraitImportProgress();
    updateNodeData(opts.nodeId, {
      portraitKind: kind,
      portraitStatus: "pending",
      portraitImportMessage: "提交入库…",
    });

    try {
      const importer =
        kind === "real" ? importCanvasRealPortrait : importCanvasVirtualPortrait;
      patchPortraitImportProgress({
        volcengine: { status: "running", detail: "上传素材至火山…" },
      });

      const result = await importer(base, {
        imageUrl,
        name: String(d.label ?? "canvas-portrait"),
        projectId: opts.projectId,
        edition: opts.edition,
      });

      let final = result;
      if (result.status === "pending" && result.assetId) {
        patchPortraitImportProgress({
          volcengine: { status: "running", detail: "火山侧处理中，轮询状态…" },
        });
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          final = await fetchCanvasPortraitImportStatus(base, {
            assetId: result.assetId,
            kind,
            edition: opts.edition,
            projectId: opts.projectId,
          });
          if (final.status !== "pending") break;
        }
      }

      const assetUri = final.assetUri?.startsWith("asset://")
        ? final.assetUri
        : buildPortraitAssetUri(final.assetId);

      updateNodeData(opts.nodeId, {
        portraitKind: kind,
        portraitAssetId: final.assetId,
        portraitAssetUri: assetUri,
        portraitStatus: final.status,
        portraitGroupId: final.groupId,
        portraitImportMessage: final.message,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
      }

      if (final.status === "active") {
        patchPortraitImportProgress({
          volcengine: {
            status: "success",
            detail: `已就绪 · ${assetUri}`,
          },
          projectAsset: { status: "running", detail: "写入项目资产私域人像库…" },
        });

        try {
          const saved = await savePortraitToProjectAssets({
            base,
            displayName: String(d.label ?? "canvas-portrait"),
            imageUrl,
            assetUri,
            assetId: final.assetId,
            portraitKind: kind,
            portraitStatus: final.status,
            groupId: final.groupId,
            projectId: opts.projectId,
            nodeId: opts.nodeId,
            edition: opts.edition,
          });
          patchPortraitImportProgress({
            projectAsset: {
              status: "success",
              detail: saved.created
                ? "已保存至项目资产「私域人像库」"
                : "项目资产中已存在同一条人像记录",
            },
            canClose: true,
          });
        } catch (saveErr) {
          patchPortraitImportProgress({
            projectAsset: {
              status: "error",
              detail: formatPortraitProjectAssetError(saveErr),
            },
            canClose: true,
          });
        }
      } else if (final.status === "pending") {
        patchPortraitImportProgress({
          volcengine: {
            status: "running",
            detail: "火山侧仍在处理，请稍后再次点击入库刷新状态",
          },
          projectAsset: { status: "skipped", detail: "等待步骤 1 完成" },
          canClose: true,
        });
      } else {
        patchPortraitImportProgress({
          volcengine: {
            status: "error",
            detail: final.message ?? "火山侧素材处理失败",
          },
          projectAsset: { status: "skipped" },
          canClose: true,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateNodeData(opts.nodeId, {
        portraitStatus: "failed",
        portraitImportMessage: msg,
      });
      patchPortraitImportProgress({
        volcengine: { status: "error", detail: msg },
        projectAsset: { status: "skipped" },
        canClose: true,
      });
    } finally {
      setImporting(false);
    }
  }, [
    alert,
    base,
    confirm,
    doubleConfirm,
    opts,
    updateNodeData,
  ]);

  return { importPortrait, importing };
}
