"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  ScanFace,
  X,
} from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  createSbv1PortraitLivenessSession,
  pollSbv1PortraitLivenessResult,
} from "@/lib/canvas/sbv1-portrait-liveness-api";
import { SBV1_VIDEO_COMPOSE_LABEL } from "@/lib/canvas/sbv1-node-chrome";

const MODAL_Z = 1250;
const POLL_MS = 2500;

type Phase = "idle" | "loading" | "scan" | "polling" | "done" | "error";

export function Sbv1PortraitLivenessModal({
  open,
  onClose,
  onSuccess,
  existingGroupId,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (groupId: string) => void;
  existingGroupId?: string;
}) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [h5Link, setH5Link] = useState("");
  const [groupId, setGroupId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<number | null>(null);
  const tokenRef = useRef("");

  const stopPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPoll = useCallback(
    (token: string) => {
      if (!base) return;
      stopPoll();
      setPhase("polling");
      const tick = async () => {
        try {
          const res = await pollSbv1PortraitLivenessResult(base, token);
          if (res.status === "succeeded" && res.groupId) {
            stopPoll();
            setGroupId(res.groupId);
            setPhase("done");
            onSuccess(res.groupId);
            return;
          }
          if (res.status === "failed") {
            stopPoll();
            setErrorMsg(res.message ?? "活体认证失败");
            setPhase("error");
          }
        } catch (e) {
          stopPoll();
          setErrorMsg(e instanceof Error ? e.message : String(e));
          setPhase("error");
        }
      };
      void tick();
      pollRef.current = window.setInterval(() => void tick(), POLL_MS);
    },
    [base, onSuccess, stopPoll],
  );

  const startSession = useCallback(async () => {
    if (!base) {
      await alert({
        title: "画布未就绪",
        message: "请刷新页面后重试。",
        variant: "warning",
      });
      return;
    }
    setPhase("loading");
    setErrorMsg("");
    setGroupId("");
    try {
      const session = await createSbv1PortraitLivenessSession(base);
      setH5Link(session.h5Link);
      tokenRef.current = session.bytedToken;
      setPhase("scan");
      startPoll(session.bytedToken);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [alert, base, startPoll]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      stopPoll();
      setPhase("idle");
      setH5Link("");
      tokenRef.current = "";
      setGroupId("");
      setErrorMsg("");
      return;
    }
    void startSession();
    return () => stopPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 open 变化时重建会话
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const copyLink = useCallback(async () => {
    if (!h5Link) return;
    try {
      await navigator.clipboard.writeText(h5Link);
      await alert({
        title: "已复制",
        message: "H5 认证链接已复制，请发送到待认证者手机打开。",
        variant: "info",
      });
    } catch {
      await alert({
        title: "复制失败",
        message: "请手动选中链接复制。",
        variant: "warning",
      });
    }
  }, [alert, h5Link]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      style={{ zIndex: MODAL_Z }}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="nodrag nowheel flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141418] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-medium text-white">
              <ScanFace className="size-4 text-cyan-300" />
              真人人像 · 活体认证
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/55">
              按火山
              <a
                href="https://www.volcengine.com/docs/82379/2333589?lang=zh"
                target="_blank"
                rel="noreferrer"
                className="mx-0.5 text-cyan-300/90 underline-offset-2 hover:underline"
              >
                真人人像库指南
              </a>
              ：待认证者在手机打开 H5 链接完成本人验证，通过后获得 GroupId，用于
              asset:// 引用。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {existingGroupId ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/50">
              当前已绑定 GroupId：
              <span className="ml-1 font-mono text-white/75">
                {existingGroupId}
              </span>
            </p>
          ) : null}

          {phase === "loading" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-white/60">
              <Loader2 className="size-8 animate-spin text-cyan-300/80" />
              <p className="text-sm">正在创建 H5 活体会话…</p>
            </div>
          ) : null}

          {(phase === "scan" || phase === "polling") && h5Link ? (
            <div className="space-y-3">
              <div className="flex justify-center rounded-xl border border-white/10 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(h5Link)}`}
                  alt="H5 活体认证二维码"
                  width={180}
                  height={180}
                  className="size-[180px]"
                />
              </div>
              <p className="text-center text-[12px] text-white/55">
                请用手机扫码或打开链接，完成真人活体认证（约 2 分钟内有效）
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="nodrag inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px] text-white/80 hover:bg-white/5"
                  onClick={() => void copyLink()}
                >
                  <Copy className="size-3.5" />
                  复制 H5 链接
                </button>
                <a
                  href={h5Link}
                  target="_blank"
                  rel="noreferrer"
                  className="nodrag inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px] text-white/80 hover:bg-white/5"
                >
                  <ExternalLink className="size-3.5" />
                  打开 H5
                </a>
              </div>
              {phase === "polling" ? (
                <p className="flex items-center justify-center gap-2 text-[12px] text-cyan-200/80">
                  <Loader2 className="size-3.5 animate-spin" />
                  等待认证完成…
                </p>
              ) : null}
            </div>
          ) : null}

          {phase === "done" && groupId ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center">
              <Check className="mx-auto mb-2 size-8 text-emerald-300" />
              <p className="text-sm font-medium text-emerald-100">认证成功</p>
              <p className="mt-2 break-all font-mono text-[11px] text-emerald-100/80">
                GroupId: {groupId}
              </p>
              <p className="mt-2 text-[11px] text-white/45">
                已写入本{SBV1_VIDEO_COMPOSE_LABEL}节点；生成视频时可引用 asset:// 人像资产。
              </p>
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12px] leading-relaxed text-red-100">
              <p className="whitespace-pre-wrap">
                {errorMsg || "创建或查询活体会话失败"}
              </p>
              {errorMsg.includes("真人人像库") || errorMsg.includes("404") ? (
                <p className="text-[11px] text-red-100/75">
                  常见原因：火山账号未开通真人人像库、API Key 无 portrait 权限、或
                  BOOK_MALL_ORIGIN 未配置为 H5 可回调的公网地址。详见
                  <a
                    href="https://www.volcengine.com/docs/82379/2333589?lang=zh"
                    target="_blank"
                    rel="noreferrer"
                    className="mx-0.5 text-cyan-200 underline-offset-2 hover:underline"
                  >
                    真人人像库指南
                  </a>
                  。
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          {phase === "error" ? (
            <button
              type="button"
              className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/5"
              onClick={() => void startSession()}
            >
              重试
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:bg-white/90"
            onClick={onClose}
          >
            {phase === "done" ? "完成" : "关闭"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
