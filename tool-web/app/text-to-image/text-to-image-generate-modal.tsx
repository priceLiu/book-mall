"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { createPortal } from "react-dom";
import { ToolChargeSubmitButton } from "@/components/ui/tool-charge-submit-button";
import { ToolShellCloseButton } from "@/components/ui/tool-shell-close-button";
import { useToolsSession } from "@/components/tool-shell-client";
import styles from "./text-to-image-modal.module.css";

type TaskOutput = {
  task_status?: string;
  task_id?: string;
  results?: Array<{ url?: string }>;
};

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90;
const SETTLE_ATTEMPTS = 4;
const SETTLE_BASE_DELAY_MS = 350;

const TTI_CHARGE_TITLE =
  "单次任务按 0.5 元从工具账户扣费（以主站「工具管理」定价为准）。";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 「填写提示词」入口默认：抽象画风 */
export const TEXT_TO_IMAGE_PROMPT_ABSTRACT =
  "一幅抽象派绘画风格的画面：奔放而富有节奏的笔触与几何色块交织，钴蓝、赭石与明黄大胆撞色并晕染衔接；非具象构图，强调运动感与情绪张力，画布肌理若隐若现刮刀痕迹；柔和的美术馆顶光，细节清晰，高分辨率，富有表现力，可作装饰画收藏。";

/** 「直接生成」入口默认：插画 · 祖国山河 */
export const TEXT_TO_IMAGE_PROMPT_HOMELAND =
  "一幅插画风格的祖国山河：巍巍远山叠翠、云海缭绕其间，大江大河蜿蜒穿过丘陵与平原；柔和的晨光或金色暮色铺满天际，冷暖色调自然衔接；近景草木葱茏、水面波光粼粼，整体气势磅礴又富有诗意；笔触细腻、层次清晰，高清可作装饰画或出版物配图。";

export type TextToImagePromptPreset = "abstract" | "homeland";

export function TextToImageGenerateModal({
  open,
  onOpenChange,
  promptPreset = "abstract",
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  promptPreset?: TextToImagePromptPreset;
}) {
  const {
    loading: sessLoading,
    session,
    hasTokenCookie,
    refetch: refetchToolsSession,
  } = useToolsSession();
  const [mounted, setMounted] = useState(false);

  const [prompt, setPrompt] = useState(TEXT_TO_IMAGE_PROMPT_ABSTRACT);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showRight, setShowRight] = useState(false);

  const [polling, setPolling] = useState(false);
  const [settlingBilling, setSettlingBilling] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [settleBanner, setSettleBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [savedUrlSet, setSavedUrlSet] = useState<Set<string>>(() => new Set());
  const [settleNeedsRetry, setSettleNeedsRetry] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const abortPollRef = useRef(false);
  const settleTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void refetchToolsSession();
  }, [open, refetchToolsSession]);

  useEffect(() => {
    if (!open) return;
    setPrompt(
      promptPreset === "homeland"
        ? TEXT_TO_IMAGE_PROMPT_HOMELAND
        : TEXT_TO_IMAGE_PROMPT_ABSTRACT,
    );
    setNegativePrompt("");
  }, [open, promptPreset]);

  useEffect(() => {
    if (!saveToast) return;
    const tid = window.setTimeout(() => setSaveToast(null), 3800);
    return () => window.clearTimeout(tid);
  }, [saveToast]);

  useEffect(() => {
    if (!open) {
      abortPollRef.current = true;
      setShowRight(false);
      setPolling(false);
      setFatalError(null);
      setSettleBanner(null);
      setSuccessBanner(null);
      setResultUrls([]);
      setSavingUrl(null);
      setSavedUrlSet(new Set());
      setSettlingBilling(false);
      setSettleNeedsRetry(false);
      settleTaskIdRef.current = null;
      setPreviewUrl(null);
      setSaveToast(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (previewUrl) {
        setPreviewUrl(null);
        return;
      }
      onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, previewUrl]);

  const pollUntilDone = useCallback(async (taskId: string): Promise<TaskOutput | null> => {
    abortPollRef.current = false;
    for (let i = 0; i < MAX_POLLS; i++) {
      if (abortPollRef.current) return null;
      const r = await fetch(
        `/api/text-to-image/task?id=${encodeURIComponent(taskId)}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const data = (await r.json()) as { output?: TaskOutput; error?: string };
      if (!r.ok) {
        throw new Error(data.error ?? `查询任务失败（HTTP ${r.status}）`);
      }
      const output = data.output;
      const st = output?.task_status ?? "";
      if (st === "SUCCEEDED") return output ?? null;
      if (st === "FAILED" || st === "UNKNOWN") {
        throw new Error(`生成失败（状态 ${st || "UNKNOWN"}）`);
      }
      await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
    }
    throw new Error("生成超时，请稍后在我的图片库或费用明细中核对是否已扣费");
  }, []);

  const attemptSettle = useCallback(async (taskId: string) => {
    const runOnce = async () => {
      const settleR = await fetch("/api/text-to-image/settle", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const settleJson = (await settleR.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      return { settleR, settleJson };
    };

    const apply = (settleR: Response, settleJson: Record<string, unknown>) => {
      if (settleR.status === 402) {
        const req = settleJson.requiredMinor;
        setSettleBanner(
          `账户余额不足，无法完成本次计费（${typeof req === "number" ? `需 ${(req as number) / 100} 元` : "需 0.5 元"}）。图片仍可依链接临时查看，建议充值后再次生成。`,
        );
        setSuccessBanner(null);
        return;
      }
      if (!settleR.ok) {
        const msg =
          typeof settleJson.error === "string"
            ? settleJson.error
            : `计费请求失败（HTTP ${settleR.status}）`;
        setSettleBanner(msg);
        setSuccessBanner(null);
        return;
      }
      setSettleBanner(null);
      if (settleJson.duplicate === true) {
        setSuccessBanner("计费记录已存在（幂等），无需重复扣款。");
      } else if (settleJson.recorded === true) {
        setSuccessBanner("已按单次生成计费（0.5 元），可在费用明细中查看。");
      } else {
        setSuccessBanner(null);
      }
    };

    for (let attempt = 1; attempt <= SETTLE_ATTEMPTS; attempt++) {
      try {
        const { settleR, settleJson } = await runOnce();
        if (settleR.status === 402) {
          apply(settleR, settleJson);
          setSettleNeedsRetry(false);
          return;
        }
        if (settleR.ok) {
          apply(settleR, settleJson);
          setSettleNeedsRetry(false);
          return;
        }
        const retryable =
          settleR.status === 502 ||
          settleR.status === 503 ||
          settleR.status === 504 ||
          settleR.status === 429;
        if (retryable && attempt < SETTLE_ATTEMPTS) {
          await delay(SETTLE_BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        apply(settleR, settleJson);
        setSettleNeedsRetry(true);
        return;
      } catch {
        if (attempt < SETTLE_ATTEMPTS) {
          await delay(SETTLE_BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        setSettleBanner(
          "计费上报失败（网络异常）。图片已保留；请稍后核对费用明细，或点击下方「重试计费」。",
        );
        setSuccessBanner(null);
        setSettleNeedsRetry(true);
        return;
      }
    }
  }, []);

  const handleRetrySettle = useCallback(async () => {
    const id = settleTaskIdRef.current?.trim();
    if (!id) return;
    setSettlingBilling(true);
    try {
      await attemptSettle(id);
    } finally {
      setSettlingBilling(false);
    }
  }, [attemptSettle]);

  const handleGenerate = useCallback(async () => {
    setFatalError(null);
    setSettleBanner(null);
    setSuccessBanner(null);
    setSaveToast(null);
    setResultUrls([]);
    setSavedUrlSet(new Set());
    setSettleNeedsRetry(false);

    if (!hasTokenCookie) {
      setFatalError("未检测到工具站令牌，请先从主站进入工具站或点击右上角「重新连接」。");
      return;
    }

    const p = prompt.trim();
    if (!p) {
      setFatalError("请先填写提示词。");
      return;
    }

    setShowRight(true);
    setPolling(true);
    abortPollRef.current = false;

    try {
      const startR = await fetch("/api/text-to-image/start", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: p,
          negativePrompt: negativePrompt.trim() || undefined,
          n: 4,
        }),
      });
      const startJson = (await startR.json()) as {
        taskId?: string;
        error?: string;
      };
      if (!startR.ok) {
        throw new Error(startJson.error ?? `创建任务失败（HTTP ${startR.status}）`);
      }
      const taskId = startJson.taskId?.trim();
      if (!taskId) throw new Error("接口未返回任务编号");

      settleTaskIdRef.current = taskId;

      const output = await pollUntilDone(taskId);
      if (!output || abortPollRef.current) return;

      const urls = (output.results ?? [])
        .map((x) => {
          const raw = x.url?.trim();
          if (!raw) return null;
          try {
            const u = new URL(raw);
            if (u.protocol === "http:" && /\.aliyuncs\.com$/i.test(u.hostname)) {
              u.protocol = "https:";
              return u.href;
            }
            return raw;
          } catch {
            return null;
          }
        })
        .filter((u): u is string => Boolean(u && /^https:\/\//i.test(u)));

      if (urls.length === 0) {
        throw new Error("任务已成功但未返回图片地址，请稍后重试。");
      }

      setResultUrls(urls);
      setPolling(false);

      setSettlingBilling(true);
      try {
        await attemptSettle(taskId);
      } finally {
        setSettlingBilling(false);
      }
    } catch (e) {
      setFatalError(e instanceof Error ? e.message : String(e));
      setResultUrls([]);
    } finally {
      setPolling(false);
    }
  }, [attemptSettle, hasTokenCookie, negativePrompt, pollUntilDone, prompt]);

  const handleSaveOne = useCallback(
    async (url: string) => {
      const p = prompt.trim();
      setSavingUrl(url);
      setFatalError(null);
      try {
        const r = await fetch("/api/text-to-image/persist-library", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrl: url, prompt: p }),
        });
        const data = (await r.json()) as { error?: string };
        if (!r.ok) {
          throw new Error(data.error ?? `保存失败（HTTP ${r.status}）`);
        }
        setSavedUrlSet((prev) => new Set(prev).add(url));
        setSaveToast("已保存到我的图片库，可在侧边栏「我的图片库」查看。");
      } catch (e) {
        setFatalError(e instanceof Error ? e.message : String(e));
      } finally {
        setSavingUrl(null);
      }
    },
    [prompt],
  );

  if (!mounted || !open) return null;

  const bodyClass = showRight
    ? `${styles.body} ${styles.twoCols}`
    : `${styles.body} ${styles.singleColFill}`;

  const portal = createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tti-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <h2 id="tti-modal-title" className={styles.title}>
            文生图 · 填写提示词
          </h2>
          <ToolShellCloseButton onClick={() => onOpenChange(false)} />
        </header>

        <div className={bodyClass}>
          <div className={styles.leftPane}>
            <div className={styles.leftPaneScroll}>
            <label className={styles.label} htmlFor="tti-prompt">
              正向提示词
            </label>
            <textarea
              id="tti-prompt"
              className={styles.textarea}
              placeholder="用中文描述画面主体、氛围、光线与风格等（不超过 800 字）"
              maxLength={800}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={polling || settlingBilling}
            />
            <p className={styles.hint}>还可输入 {800 - prompt.length} 字</p>

            <label className={styles.label} htmlFor="tti-neg">
              反向提示词（可选）
            </label>
            <textarea
              id="tti-neg"
              className={styles.textarea}
              placeholder="不希望出现在画面中的内容（可选，不超过 500 字）"
              maxLength={500}
              rows={3}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              disabled={polling || settlingBilling}
            />

            {fatalError ? (
              <p className="tool-reminder-danger">{fatalError}</p>
            ) : null}

            {!sessLoading && !hasTokenCookie ? (
              <p className="tool-reminder-warn">
                未检测到工具站会话 Cookie，请从主站进入工具站；也可点击顶部右侧「重新连接」领取令牌后再生成。
              </p>
            ) : null}
            {!sessLoading && hasTokenCookie && !session.active ? (
              <p className="tool-reminder-warn">
                令牌已写入，但主站校验未完成（常见于数据库冷启动）。仍可尝试生成；异常时请点顶部右侧「重新连接」刷新会话。
              </p>
            ) : null}
            </div>

            <div className={styles.leftPaneFooter}>
              <ToolChargeSubmitButton
                busy={polling || settlingBilling}
                disabled={sessLoading || !hasTokenCookie}
                onClick={() => void handleGenerate()}
                primaryLabel="生成 4 张图片"
                busyLabel="生成中…"
                chargeLine="一次生成 4 张图，扣费 0.5 元"
                chargeTitle={TTI_CHARGE_TITLE}
                idleIcon={<Sparkles className="h-4 w-4" aria-hidden />}
              />
            </div>
          </div>

          {showRight ? (
            <div className={styles.rightPane}>
              <div className={styles.rightHead}>生成结果 · wanx2.1-t2i-plus</div>

              {saveToast ? (
                <p
                  className="tool-reminder-banner tool-reminder-banner--block"
                  role="status"
                  style={{ margin: 0 }}
                >
                  {saveToast}
                </p>
              ) : null}

              {settleBanner ? (
                <p className="tool-reminder-warn">{settleBanner}</p>
              ) : null}
              {successBanner ? (
                <p className="tool-reminder-banner tool-reminder-banner--block">
                  {successBanner}
                </p>
              ) : null}

              {settleNeedsRetry ? (
                <div style={{ marginTop: "0.35rem", marginBottom: "0.35rem" }}>
                  <button
                    type="button"
                    className={styles.btnSmall}
                    disabled={settlingBilling}
                    onClick={() => void handleRetrySettle()}
                  >
                    {settlingBilling ? "正在重试计费…" : "重试计费"}
                  </button>
                </div>
              ) : null}

              {polling ? (
                <>
                  <div className={styles.robotRow}>
                    <span className={styles.robotGlyph} aria-hidden>
                      🤖
                    </span>
                    <p className={styles.robotText}>
                      模型正在作画，通常需要数十秒。请勿关闭窗口…
                    </p>
                  </div>
                  <div className={styles.skelGrid}>
                    {[0, 1, 2, 3].map((k) => (
                      <div key={k} className={styles.skelCard} aria-hidden />
                    ))}
                  </div>
                </>
              ) : resultUrls.length > 0 ? (
                <div className={styles.resultGrid}>
                  {resultUrls.map((url) => (
                    <div key={url} className={styles.resultCard}>
                      <button
                        type="button"
                        className={styles.resultThumbBtn}
                        aria-label="查看大图"
                        onClick={() => setPreviewUrl(url)}
                      >
                        <div className={styles.resultThumbWrap}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            className={styles.resultThumbImg}
                            referrerPolicy="no-referrer"
                          />
                          <span className={styles.resultThumbGlass} aria-hidden>
                            🔍
                          </span>
                        </div>
                      </button>
                      <div className={styles.resultFoot}>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          disabled={savingUrl === url || savedUrlSet.has(url)}
                          onClick={() => void handleSaveOne(url)}
                        >
                          {savedUrlSet.has(url)
                            ? "已保存"
                            : savingUrl === url
                              ? "保存中…"
                              : "保存到图片库"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : fatalError ? (
                <p className={styles.hint}>生成未成功，请检查提示词或稍后重试。</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );

  const imageLightbox =
    mounted &&
    previewUrl &&
    createPortal(
      <div
        className={styles.imageLightbox}
        role="dialog"
        aria-modal="true"
        aria-label="查看大图"
        onClick={() => setPreviewUrl(null)}
      >
        <div
          className={styles.imageLightboxInner}
          onClick={(e) => e.stopPropagation()}
        >
          <ToolShellCloseButton
            floating
            label="关闭"
            onClick={() => setPreviewUrl(null)}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className={styles.imageLightboxImg}
            referrerPolicy="no-referrer"
          />
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      {portal}
      {imageLightbox}
    </>
  );
}
