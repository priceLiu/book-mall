"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { ToolChargeSubmitButton } from "@/components/ui/tool-charge-submit-button";
import { MessagesLocaleProvider, useMessagesLocale } from "@/components/messages-locale-context";
import type { AiFitModelRecord } from "@/lib/ai-fit-types";
import { prefillGarmentsFromOutfit } from "@/lib/ai-fit-prefill-from-outfit";
import { OUTFITS } from "@/lib/fitting-room-data";
import { FITTING_ROOM_IMG_FALLBACK } from "@/lib/fitting-room-fallback-image";
import { fittingRoomImageSrc } from "@/lib/fitting-room-image-url";
import { ToolImplementationCrossLink } from "@/components/tool-implementation-crosslink";
import { AiFitAddModelModal, type AddModelPayload } from "./ai-fit-add-model-modal";
import styles from "./ai-fit.module.css";

type GarmentMode = "two_piece" | "one_piece";
type RightPanel = "idle" | "models" | "loading";

/** 阿里云文档示例图（公网 URL，便于本地直连百炼） */
const DEMO_TOP =
  "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250626/epousa/short_sleeve.jpeg";

const DEMO_BOTTOM =
  "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250626/rchumi/pants.jpeg";

const DEMO_ONE =
  "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250626/odngby/dress.jpg";

/** 百炼 OSS 签名 URL 常为 http，与阿里云 OSS 约定一致时可安全升为 https */
function normalizeTryOnImageUrl(u: string): string {
  try {
    const x = new URL(u.trim());
    if (x.protocol === "http:" && /\.aliyuncs\.com$/i.test(x.hostname)) {
      x.protocol = "https:";
      return x.href;
    }
    return x.href;
  } catch {
    return u.trim();
  }
}

function normalizeModels(list: AiFitModelRecord[]): AiFitModelRecord[] {
  const picked = list.find((m) => m.selected);
  const sid = picked?.id ?? list[0]?.id;
  return list.map((m) => ({ ...m, selected: m.id === sid }));
}

type ApiCustomModel = {
  id: string;
  name: string;
  style: string;
  height: string;
  weight: string;
  body: string;
  bust?: string;
  waist?: string;
  hips?: string;
  imageDataUrl: string;
  isCustom?: boolean;
};

function apiModelToRecord(m: ApiCustomModel): AiFitModelRecord {
  return {
    id: m.id,
    name: m.name,
    style: m.style,
    height: m.height,
    weight: m.weight,
    body: m.body,
    bust: m.bust,
    waist: m.waist,
    hips: m.hips,
    image: m.imageDataUrl,
    isCustom: true,
  };
}

async function postGarmentUpload(slot: "top" | "bottom" | "one_piece", imageDataUrl: string) {
  return fetch("/api/ai-fit/upload-garment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot, imageDataUrl }),
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TryOnPollUsage = {
  recorded: boolean;
  insufficientBalance?: boolean;
  error?: string | null;
  chargedMinor?: number;
  billingDuplicate?: boolean;
};

function formatTryOnBillingLine(
  u: TryOnPollUsage | undefined,
  t: (key: string) => string,
): string {
  if (!u?.recorded) return t("billingReminderAfterTryOn");
  const amount =
    u.chargedMinor != null ? (u.chargedMinor / 100).toFixed(2) : null;
  if (amount != null && u.billingDuplicate) {
    return t("tryOnBillingDuplicate").replace(/\{\{amount\}\}/g, amount);
  }
  if (amount != null) {
    return t("tryOnBillingCharged").replace(/\{\{amount\}\}/g, amount);
  }
  return t("billingReminderAfterTryOn");
}

function imgSrc(url: string): string {
  if (url.startsWith("data:")) return url;
  return fittingRoomImageSrc(url);
}

function handleModelImageError(e: SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (el.dataset.aiFitImgFb === "1") return;
  el.dataset.aiFitImgFb = "1";
  el.src = FITTING_ROOM_IMG_FALLBACK;
}

function AiFitWorkspace({ initialModels }: { initialModels: AiFitModelRecord[] }) {
  const { locale, setLocale, t } = useMessagesLocale();
  const initialCatalogRef = useRef(initialModels);
  initialCatalogRef.current = initialModels;

  const [models, setModels] = useState<AiFitModelRecord[]>(() =>
    normalizeModels(initialModels),
  );
  const [garmentMode, setGarmentMode] = useState<GarmentMode>("two_piece");
  const [rightPanel, setRightPanel] = useState<RightPanel>("idle");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [topPreview, setTopPreview] = useState<string | null>(null);
  const [bottomPreview, setBottomPreview] = useState<string | null>(null);
  const [onePreview, setOnePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [tryOnResultUrl, setTryOnResultUrl] = useState<string | null>(null);
  const [tryOnBusy, setTryOnBusy] = useState(false);
  const [tryOnResultMeta, setTryOnResultMeta] = useState<{
    garmentMode: GarmentMode;
    personImageUrl: string | null;
    topGarmentUrl: string | null;
    bottomGarmentUrl: string | null;
    taskId: string | null;
  } | null>(null);
  const [closetSaveState, setClosetSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [closetSaveError, setClosetSaveError] = useState<string | null>(null);
  const [tryOnUsageWarn, setTryOnUsageWarn] = useState<string | null>(null);
  const [tryOnBillingLine, setTryOnBillingLine] = useState<string>("");

  const restoreRightRef = useRef<Exclude<RightPanel, "loading">>("idle");

  const topInputId = useId();
  const bottomInputId = useId();
  const oneInputId = useId();

  const router = useRouter();
  const searchParams = useSearchParams();
  const outfitIdFromUrl = searchParams.get("id")?.trim() ?? "";
  const lastAppliedOutfitIdRef = useRef<string | null>(null);

  const selectedModel = useMemo(() => models.find((m) => m.selected) ?? null, [models]);

  useEffect(() => {
    if (!outfitIdFromUrl) {
      lastAppliedOutfitIdRef.current = null;
      return;
    }
    if (lastAppliedOutfitIdRef.current === outfitIdFromUrl) return;

    const outfit = OUTFITS.find((o) => o.id === outfitIdFromUrl);
    if (!outfit) {
      lastAppliedOutfitIdRef.current = outfitIdFromUrl;
      setFormError(t("fittingRoomOutfitNotFound"));
      router.replace("/fitting-room/ai-fit", { scroll: false });
      return;
    }

    lastAppliedOutfitIdRef.current = outfitIdFromUrl;
    const p = prefillGarmentsFromOutfit(outfit);
    setGarmentMode(p.garmentMode);
    if (p.garmentMode === "one_piece") {
      setTopPreview(null);
      setBottomPreview(null);
      setOnePreview(p.oneUrl);
    } else {
      setOnePreview(null);
      setTopPreview(p.topUrl);
      setBottomPreview(p.bottomUrl);
    }
    setFormError(null);
    router.replace("/fitting-room/ai-fit", { scroll: false });
  }, [outfitIdFromUrl, router, t]);

  const runGarmentUploadNotify = useCallback(
    async (
      slot: "top" | "bottom" | "one_piece",
      imageDataUrl: string,
    ): Promise<void> => {
      if (!imageDataUrl.includes(";base64,")) return;
      try {
        const r = await postGarmentUpload(slot, imageDataUrl);
        if (r.status === 401) setFormError(t("loginRequiredTools"));
        else if (!r.ok) setFormError(t("garmentUploadFailed"));
      } catch {
        setFormError(t("garmentUploadFailed"));
      }
    },
    [t],
  );

  const setGarmentFromFile = useCallback(
    (
      slot: "top" | "bottom" | "one_piece",
      setter: (u: string | null) => void,
      file: File,
    ) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setter(dataUrl);
        setFormError(null);
        void runGarmentUploadNotify(slot, dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [runGarmentUploadNotify],
  );

  const openModelPicker = useCallback(() => setRightPanel("models"), []);

  const handleSaveToCloset = useCallback(async () => {
    if (!tryOnResultUrl || !tryOnResultMeta) return;
    if (!/^https:\/\//i.test(tryOnResultUrl)) {
      const preview =
        tryOnResultUrl.length > 220 ? `${tryOnResultUrl.slice(0, 220)}…` : tryOnResultUrl;
      setClosetSaveError(`imageUrl 不是 https：${preview}`);
      setClosetSaveState("error");
      return;
    }
    setClosetSaveState("saving");
    setClosetSaveError(null);
    try {
      const r = await fetch("/api/ai-fit/closet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: tryOnResultUrl,
          garmentMode: tryOnResultMeta.garmentMode,
          personImageUrl: tryOnResultMeta.personImageUrl,
          topGarmentUrl: tryOnResultMeta.topGarmentUrl,
          bottomGarmentUrl: tryOnResultMeta.bottomGarmentUrl,
          taskId: tryOnResultMeta.taskId,
        }),
      });
      if (r.status === 401) {
        setClosetSaveError(t("loginRequiredTools"));
        setFormError(t("loginRequiredTools"));
        setClosetSaveState("error");
        return;
      }
      let payload:
        | { error?: string; item?: { id?: string } }
        | undefined;
      try {
        payload = (await r.json()) as typeof payload;
      } catch {
        /* 非 JSON 响应（例如代理层错误）保持 payload 为 undefined */
      }
      if (!r.ok) {
        const msg = payload?.error?.trim();
        setClosetSaveError(msg ? `${msg}（HTTP ${r.status}）` : `HTTP ${r.status}`);
        setClosetSaveState("error");
        return;
      }
      setClosetSaveState("saved");
    } catch (e) {
      setClosetSaveError(e instanceof Error ? e.message : String(e));
      setClosetSaveState("error");
    }
  }, [t, tryOnResultMeta, tryOnResultUrl]);

  const selectModelId = useCallback((id: string) => {
    setModels((prev) => prev.map((m) => ({ ...m, selected: m.id === id })));
    setFormError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/ai-fit/custom-models", { cache: "no-store" });
        const data = (await r.json()) as { models?: ApiCustomModel[] };
        if (
          cancelled ||
          !r.ok ||
          !Array.isArray(data.models) ||
          data.models.length === 0
        ) {
          return;
        }
        const fromApi = data.models.map(apiModelToRecord);
        setModels((prev) => {
          const defaults = initialCatalogRef.current.map(
            ({ selected: _s, ...rest }) => ({
              ...rest,
              isCustom: false,
            }),
          );
          const apiIds = new Set(fromApi.map((m) => m.id));
          const localOnlyCustom = prev.filter(
            (m) => m.isCustom === true && !apiIds.has(m.id),
          );
          return normalizeModels([...fromApi, ...localOnlyCustom, ...defaults]);
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddModel = useCallback(async (p: AddModelPayload) => {
    const res = await fetch("/api/ai-fit/custom-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: p.name,
        style: p.style,
        height: p.height,
        weight: p.weight,
        body: p.body,
        bust: p.bust,
        waist: p.waist,
        hips: p.hips,
        imageDataUrl: p.imageDataUrl,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      model?: ApiCustomModel;
    };
    if (!res.ok || !data.model) {
      if (res.status === 401) {
        throw new Error(t("loginRequiredTools"));
      }
      if (
        res.status === 503 &&
        data.error === "main_origin_not_configured"
      ) {
        throw new Error(t("saveModelMainSiteEnv"));
      }
      const upstream =
        typeof data.error === "string" && data.error.length > 0
          ? data.error
          : "";
      if (upstream) {
        throw new Error(upstream);
      }
      throw new Error(t("saveModelFailed"));
    }
    const record = apiModelToRecord(data.model);
    setModels((prev) => {
      const withoutDup = prev.filter((m) => m.id !== record.id);
      const defaults = withoutDup.filter((m) => !m.isCustom);
      const customs = withoutDup.filter((m) => m.isCustom);
      return normalizeModels([
        { ...record, selected: true },
        ...customs.map((m) => ({ ...m, selected: false })),
        ...defaults.map((m) => ({ ...m, selected: false })),
      ]);
    });
    setFormError(null);
  }, [t]);

  const applyDemoTop = () => {
    setTopPreview(DEMO_TOP);
    setFormError(null);
    void runGarmentUploadNotify("top", DEMO_TOP);
  };

  const applyDemoBottom = () => {
    setBottomPreview(DEMO_BOTTOM);
    setFormError(null);
    void runGarmentUploadNotify("bottom", DEMO_BOTTOM);
  };

  const applyDemoOne = () => {
    setOnePreview(DEMO_ONE);
    setFormError(null);
    void runGarmentUploadNotify("one_piece", DEMO_ONE);
  };

  const garmentsReady =
    garmentMode === "two_piece"
      ? Boolean(topPreview && bottomPreview)
      : Boolean(onePreview);

  const handleStart = async () => {
    if (!selectedModel) {
      setFormError(t("validationNeedModel"));
      return;
    }
    if (
      garmentMode === "two_piece"
        ? !(topPreview && bottomPreview)
        : !onePreview
    ) {
      setFormError(t("validationNeedGarment"));
      return;
    }
    setFormError(null);
    setTryOnResultUrl(null);
    setTryOnResultMeta(null);
    setTryOnUsageWarn(null);
    setTryOnBillingLine("");
    setClosetSaveState("idle");
    restoreRightRef.current = rightPanel === "models" ? "models" : "idle";
    setRightPanel("loading");
    setTryOnBusy(true);

    const personImage = selectedModel.image;

    try {
      const body =
        garmentMode === "two_piece"
          ? {
              garmentMode: "two_piece" as const,
              personImage,
              topGarment: topPreview!,
              bottomGarment: bottomPreview!,
            }
          : {
              garmentMode: "one_piece" as const,
              personImage,
              topGarment: onePreview!,
              bottomGarment: "",
            };

      const start = await fetch("/api/ai-fit/try-on", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const sj = (await start.json()) as {
        taskId?: string;
        error?: string;
        resolvedUrls?: {
          personImage?: string | null;
          topGarment?: string | null;
          bottomGarment?: string | null;
        };
      };
      if (!start.ok || !sj.taskId) {
        throw new Error(sj.error ?? t("tryOnFailed"));
      }

      const resolvedPerson = sj.resolvedUrls?.personImage ?? null;
      const resolvedTop = sj.resolvedUrls?.topGarment ?? null;
      const resolvedBottom = sj.resolvedUrls?.bottomGarment ?? null;

      const deadline = Date.now() + 180_000;
      let imageUrl: string | null = null;
      let lastUsage: TryOnPollUsage | undefined;
      while (Date.now() < deadline) {
        await delay(2800);
        const pr = await fetch(
          `/api/ai-fit/try-on?taskId=${encodeURIComponent(sj.taskId)}`,
          { cache: "no-store" },
        );
        const pj = (await pr.json()) as {
          status?: string;
          imageUrl?: string | null;
          message?: string | null;
          error?: string;
          usage?: TryOnPollUsage;
        };
        if (!pr.ok) {
          throw new Error(pj.error ?? pj.message ?? t("tryOnFailed"));
        }
        const st = (pj.status ?? "").toUpperCase();
        const done =
          (st === "SUCCEEDED" || st === "SUCCESS") && pj.imageUrl;
        if (done) {
          imageUrl = pj.imageUrl!;
          lastUsage = pj.usage;
          const billingDone =
            lastUsage == null ||
            lastUsage.recorded === true ||
            lastUsage.insufficientBalance === true;
          if (billingDone) break;
          /** 成片已返回但计费未落库：继续轮询以便服务端重试上报（幂等 taskId） */
          await delay(2800);
          continue;
        }
        if (st === "FAILED" || st === "CANCELED") {
          throw new Error(
            pj.message ?? pj.error ?? t("tryOnFailed"),
          );
        }
      }

      if (!imageUrl) {
        throw new Error(t("tryOnTimeout"));
      }

      const usageWarn =
        lastUsage && !lastUsage.recorded
          ? (lastUsage.error?.trim() || t("tryOnUsageRecordPending"))
          : null;
      setTryOnUsageWarn(usageWarn);
      setTryOnBillingLine(
        formatTryOnBillingLine(lastUsage, t as (key: string) => string),
      );

      setTryOnResultUrl(normalizeTryOnImageUrl(imageUrl));
      setTryOnResultMeta({
        garmentMode,
        personImageUrl: resolvedPerson,
        topGarmentUrl: resolvedTop,
        bottomGarmentUrl: resolvedBottom,
        taskId: sj.taskId,
      });
      setClosetSaveState("idle");
      /** 成片只在 `idle` 右栏渲染；勿回到「模特列表」否则会误以为没有出图 */
      setRightPanel("idle");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("tryOnFailed"));
      setRightPanel(restoreRightRef.current);
    } finally {
      setTryOnBusy(false);
    }
  };

  const preventDefaults = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className={styles.workspace}>
      <header className={styles.pageHead}>
        <h1>{t("pageTitle")}</h1>
        <div
          className={styles.localeSwitch}
          role="group"
          aria-label={t("localeSwitchAria")}
        >
          <button
            type="button"
            className={`${styles.localeBtn} ${locale === "zh" ? styles.localeBtnActive : ""}`}
            aria-pressed={locale === "zh"}
            onClick={() => setLocale("zh")}
          >
            {t("localeZh")}
          </button>
          <button
            type="button"
            className={`${styles.localeBtn} ${locale === "en" ? styles.localeBtnActive : ""}`}
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            {t("localeEn")}
          </button>
        </div>
      </header>
      <ToolImplementationCrossLink href="/fitting-room/ai-fit/implementation" />

      <div className={styles.layout}>
        <aside className={styles.leftPanel}>
          <div className={styles.leftPanelScroll}>
          <section className={styles.configBlock}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionIcon} aria-hidden>
                ⚙
              </span>
              {t("configTitle")}
            </h2>
          </section>

          <section className={styles.configBlock}>
            <h2 className={styles.sectionTitle}>{t("aiModelSection")}</h2>
            <button
              type="button"
              className={styles.modelRow}
              onClick={openModelPicker}
              aria-label={t("switchModelAria")}
            >
              {selectedModel ? (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic CDN / blob / data URL
                <img
                  src={imgSrc(selectedModel.image)}
                  alt=""
                  className={styles.modelThumb}
                  referrerPolicy="no-referrer"
                  onError={handleModelImageError}
                />
              ) : (
                <div className={styles.modelThumb} />
              )}
              <span className={styles.modelRowText}>
                <span className={styles.modelRowName}>
                  {selectedModel?.name ?? "—"}
                </span>
                <span className={styles.modelRowStyle}>
                  {selectedModel?.style ?? ""}
                </span>
              </span>
              <span className={styles.modelChevron} aria-hidden>
                ›
              </span>
            </button>
          </section>

          <section className={styles.configBlock}>
            <h2 className={styles.sectionTitle}>{t("garmentSection")}</h2>
            <select
              className={styles.garmentSelect}
              value={garmentMode}
              aria-label={t("garmentSection")}
              onChange={(e) => {
                const v = e.target.value as GarmentMode;
                setGarmentMode(v);
                setFormError(null);
                if (v === "one_piece") {
                  setTopPreview(null);
                  setBottomPreview(null);
                } else {
                  setOnePreview(null);
                }
              }}
            >
              <option value="two_piece">{t("garmentTwoPiece")}</option>
              <option value="one_piece">{t("garmentOnePiece")}</option>
            </select>

            <div className={styles.uploadGrid}>
              {garmentMode === "two_piece" ? (
                <>
                  <div
                    className={styles.uploadZone}
                    onDragOver={preventDefaults}
                    onDrop={(e) => {
                      preventDefaults(e);
                      const f = e.dataTransfer.files?.[0];
                      if (f?.type.startsWith("image/"))
                        setGarmentFromFile("top", setTopPreview, f);
                    }}
                  >
                    <div className={styles.uploadZoneInner}>
                      <span className={styles.uploadGlyph} aria-hidden>
                        👕
                      </span>
                      <span className={styles.uploadTitle}>{t("uploadTop")}</span>
                      <input
                        id={topInputId}
                        type="file"
                        accept="image/*"
                        className={styles.fileInputHidden}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setGarmentFromFile("top", setTopPreview, f);
                        }}
                      />
                      <label htmlFor={topInputId} className={styles.uploadHint} style={{ cursor: "pointer" }}>
                        {t("uploadHint")}
                      </label>
                      {topPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgSrc(topPreview)} alt="" className={styles.uploadPreview} />
                      ) : null}
                      <button type="button" className={styles.sampleLink} onClick={applyDemoTop}>
                        {t("uploadOfficialSample")}
                      </button>
                    </div>
                  </div>

                  <div
                    className={styles.uploadZone}
                    onDragOver={preventDefaults}
                    onDrop={(e) => {
                      preventDefaults(e);
                      const f = e.dataTransfer.files?.[0];
                      if (f?.type.startsWith("image/"))
                        setGarmentFromFile("bottom", setBottomPreview, f);
                    }}
                  >
                    <div className={styles.uploadZoneInner}>
                      <span className={styles.uploadGlyph} aria-hidden>
                        👖
                      </span>
                      <span className={styles.uploadTitle}>{t("uploadBottom")}</span>
                      <input
                        id={bottomInputId}
                        type="file"
                        accept="image/*"
                        className={styles.fileInputHidden}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setGarmentFromFile("bottom", setBottomPreview, f);
                        }}
                      />
                      <label htmlFor={bottomInputId} className={styles.uploadHint} style={{ cursor: "pointer" }}>
                        {t("uploadHint")}
                      </label>
                      {bottomPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgSrc(bottomPreview)} alt="" className={styles.uploadPreview} />
                      ) : null}
                      <button type="button" className={styles.sampleLink} onClick={applyDemoBottom}>
                        {t("uploadOfficialSample")}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  className={styles.uploadZone}
                  onDragOver={preventDefaults}
                  onDrop={(e) => {
                    preventDefaults(e);
                    const f = e.dataTransfer.files?.[0];
                    if (f?.type.startsWith("image/")) setGarmentFromFile("one_piece", setOnePreview, f);
                  }}
                >
                  <div className={styles.uploadZoneInner}>
                    <span className={styles.uploadGlyph} aria-hidden>
                      👗
                    </span>
                    <span className={styles.uploadTitle}>{t("uploadOnePiece")}</span>
                    <input
                      id={oneInputId}
                      type="file"
                      accept="image/*"
                      className={styles.fileInputHidden}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setGarmentFromFile("one_piece", setOnePreview, f);
                      }}
                    />
                    <label htmlFor={oneInputId} className={styles.uploadHint} style={{ cursor: "pointer" }}>
                      {t("uploadHint")}
                    </label>
                    {onePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgSrc(onePreview)} alt="" className={styles.uploadPreview} />
                    ) : null}
                    <button type="button" className={styles.sampleLink} onClick={applyDemoOne}>
                      {t("uploadOfficialSample")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className={styles.quotaBox}>
            <div className={styles.quotaTop}>
              <span>{t("freeQuota")}</span>
              <span>{t("quotaValueDemo")}</span>
            </div>
            <div className={styles.quotaBar}>
              <div className={styles.quotaFill} />
            </div>
          </div>

          {formError ? <p className={styles.validationBanner}>{formError}</p> : null}
          </div>

          <div className={styles.leftPanelFooter}>
            <ToolChargeSubmitButton
              busy={tryOnBusy}
              disabled={!selectedModel || !garmentsReady}
              onClick={handleStart}
              primaryLabel={t("startFitting")}
              busyLabel={t("tryOnBusy")}
              chargeLine={t("tryOnChargeLineSub")}
              chargeTitle={t("tryOnChargeLineTitle")}
              idleIcon={<Sparkles className="h-4 w-4" aria-hidden />}
            />

            <p className={styles.disclaimer}>{t("disclaimer")}</p>
          </div>
        </aside>

        <section className={styles.rightPanel} aria-live="polite">
          {rightPanel !== "loading" ? (
            <header className={styles.rightHeader}>
              <div className={styles.rightTitleWrap}>
                <p className={styles.rightTitle}>
                  {rightPanel === "models"
                    ? t("modelPickerTitle")
                    : tryOnResultUrl
                      ? t("tryOnResultTitle")
                      : t("emptyRightTitle")}
                </p>
                {rightPanel === "models" ? (
                  <p className={styles.rightSub}>{t("genderIgnoredHint")}</p>
                ) : null}
              </div>
              <div className={styles.rightActions}>
                {rightPanel === "models" ? (
                  <>
                    <button type="button" className={styles.btnAccent} onClick={() => setAddModalOpen(true)}>
                      {t("addModel")}
                    </button>
                    <button type="button" className={styles.btnGhost} onClick={() => setRightPanel("idle")}>
                      {t("back")}
                    </button>
                  </>
                ) : rightPanel === "idle" && tryOnResultUrl ? (
                  <>
                    <Link href="/fitting-room/ai-fit/closet" className={styles.btnGhost}>
                      {t("closetPageTitle")}
                    </Link>
                    <button
                      type="button"
                      className={styles.btnAccent}
                      onClick={handleSaveToCloset}
                      disabled={
                        closetSaveState === "saving" ||
                        closetSaveState === "saved"
                      }
                    >
                      {closetSaveState === "saving"
                        ? t("savingToCloset")
                        : closetSaveState === "saved"
                          ? t("savedToCloset")
                          : t("saveToCloset")}
                    </button>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => {
                        setTryOnResultUrl(null);
                        setTryOnResultMeta(null);
                        setTryOnUsageWarn(null);
                        setTryOnBillingLine("");
                        setClosetSaveState("idle");
                        setClosetSaveError(null);
                      }}
                    >
                      {t("tryOnResultDismiss")}
                    </button>
                  </>
                ) : null}
              </div>
            </header>
          ) : null}

          {rightPanel === "idle" ? (
            <div className={styles.rightBody}>
              {tryOnResultUrl ? (
                <div className={styles.resultWrap}>
                  <p
                    className="tool-reminder-banner tool-reminder-banner--block"
                    style={{ marginBottom: "0.75rem" }}
                  >
                    {tryOnBillingLine || t("billingReminderAfterTryOn")}
                  </p>
                  {tryOnUsageWarn ? (
                    <p
                      className="tool-reminder-warn"
                      style={{ marginBottom: "0.75rem" }}
                    >
                      {tryOnUsageWarn}
                    </p>
                  ) : null}
                  <div className={styles.resultStack}>
                    <div className={styles.resultCard}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- remote OSS result */}
                      <img
                        src={tryOnResultUrl}
                        alt=""
                        className={styles.resultImg}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    {closetSaveState === "error" ? (
                      <p className={styles.validationBanner}>
                        {closetSaveError
                          ? `${t("saveClosetFailed")}：${closetSaveError}`
                          : t("saveClosetFailed")}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.emptyTitle}>{t("emptyRightTitle")}</p>
                  <p className={styles.emptyHint}>{t("emptyRightHint")}</p>
                </div>
              )}
            </div>
          ) : null}

          {rightPanel === "models" ? (
            <div className={styles.rightBody}>
              <div className={styles.modelGrid}>
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`${styles.modelCard} ${m.selected ? styles.modelCardSelected : ""}`}
                    onClick={() => selectModelId(m.id)}
                  >
                    <span className={styles.cardRadio} aria-hidden>
                      <span className={styles.cardRadioDot} />
                    </span>
                    <div className={styles.cardInner}>
                      <div className={styles.cardMeta}>
                        <span className={styles.cardName}>{m.name}</span>
                        <span className={styles.cardStyle}>{m.style}</span>
                        <div className={styles.cardStatStack}>
                          <span className={styles.cardStatLine}>
                            {t("height")} {m.height}
                          </span>
                          <span className={styles.cardStatLine}>
                            {t("weight")} {m.weight}
                          </span>
                          <span className={styles.cardStatLine}>
                            {t("bodyType")} {m.body}
                          </span>
                        </div>
                      </div>
                      <div className={styles.cardImgWrap}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- CDN/blob/data */}
                        <img
                          src={imgSrc(m.image)}
                          alt=""
                          className={styles.cardImg}
                          referrerPolicy="no-referrer"
                          onError={handleModelImageError}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {rightPanel === "loading" ? (
            <div className={styles.loadingWrap} aria-busy="true">
              <div className={styles.loadingSkeletonBlock}>
                <div className={styles.loadingSkeletonFrame}>
                  <div className={styles.loadingSkeletonShimmer} aria-hidden />
                </div>
                <p className={styles.loadingSkeletonHint}>{t("tryOnSkeletonHint")}</p>
              </div>
              <div className={styles.loadingSpinnerWrap}>
                <div className={styles.loadingGlow} aria-hidden />
                <div className={styles.loadingSpinner} />
              </div>
              <p className={styles.loadingTitle}>{t("loadingTitle")}</p>
              <p className={styles.loadingSub}>{t("loadingSubtitle")}</p>
              <div className={styles.loadingDots} aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <AiFitAddModelModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onConfirm={handleAddModel}
        t={t}
      />
    </div>
  );
}

export function AiFitClient({ initialModels }: { initialModels: AiFitModelRecord[] }) {
  return (
    <MessagesLocaleProvider>
      <AiFitWorkspace initialModels={initialModels} />
    </MessagesLocaleProvider>
  );
}
