"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { MessagesLocaleProvider, useMessagesLocale } from "@/components/messages-locale-context";
import type { AiFitModelRecord } from "@/lib/ai-fit-types";
import { FITTING_ROOM_IMG_FALLBACK } from "@/lib/fitting-room-fallback-image";
import { fittingRoomImageSrc } from "@/lib/fitting-room-image-url";
import { AiFitAddModelModal, type AddModelPayload } from "./ai-fit-add-model-modal";
import styles from "./ai-fit.module.css";

type GarmentMode = "two_piece" | "one_piece";
type RightPanel = "idle" | "models" | "loading";

const DEMO_TOP =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect fill="#ede9fe" width="100%" height="100%"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#6d28d9" font-family="system-ui,sans-serif" font-size="15" font-weight="600">TOP</text></svg>`,
  );

const DEMO_BOTTOM =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect fill="#faf5ff" width="100%" height="100%"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#7c3aed" font-family="system-ui,sans-serif" font-size="15" font-weight="600">BOTTOM</text></svg>`,
  );

const DEMO_ONE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect fill="#f5f3ff" width="100%" height="100%"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#5b21b6" font-family="system-ui,sans-serif" font-size="14" font-weight="600">ONE-PIECE</text></svg>`,
  );

function normalizeModels(list: AiFitModelRecord[]): AiFitModelRecord[] {
  const picked = list.find((m) => m.selected);
  const sid = picked?.id ?? list[0]?.id;
  return list.map((m) => ({ ...m, selected: m.id === sid }));
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
  const [models, setModels] = useState<AiFitModelRecord[]>(() => normalizeModels(initialModels));
  const [garmentMode, setGarmentMode] = useState<GarmentMode>("two_piece");
  const [rightPanel, setRightPanel] = useState<RightPanel>("idle");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [topPreview, setTopPreview] = useState<string | null>(null);
  const [bottomPreview, setBottomPreview] = useState<string | null>(null);
  const [onePreview, setOnePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const restoreRightRef = useRef<Exclude<RightPanel, "loading">>("idle");
  const loadingTimerRef = useRef<number>();

  const topInputId = useId();
  const bottomInputId = useId();
  const oneInputId = useId();

  const selectedModel = useMemo(() => models.find((m) => m.selected) ?? null, [models]);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current != null) window.clearTimeout(loadingTimerRef.current);
      if (topPreview?.startsWith("blob:")) URL.revokeObjectURL(topPreview);
      if (bottomPreview?.startsWith("blob:")) URL.revokeObjectURL(bottomPreview);
      if (onePreview?.startsWith("blob:")) URL.revokeObjectURL(onePreview);
    };
  }, [topPreview, bottomPreview, onePreview]);

  const setBlobPreview = useCallback(
    (setter: (u: string | null) => void, prevUrl: string | null, file: File) => {
      if (prevUrl?.startsWith("blob:")) URL.revokeObjectURL(prevUrl);
      setter(URL.createObjectURL(file));
      setFormError(null);
    },
    [],
  );

  const openModelPicker = useCallback(() => setRightPanel("models"), []);

  const selectModelId = useCallback((id: string) => {
    setModels((prev) => prev.map((m) => ({ ...m, selected: m.id === id })));
    setFormError(null);
  }, []);

  const handleAddModel = useCallback((p: AddModelPayload) => {
    const id = `custom-${Date.now()}`;
    const record: AiFitModelRecord = {
      id,
      name: p.name,
      style: p.style.length > 0 ? p.style : "—",
      height: p.height.length > 0 ? p.height : "—",
      weight: p.weight.length > 0 ? p.weight : "—",
      body: p.body.length > 0 ? p.body : "—",
      bust: p.bust.length > 0 ? p.bust : undefined,
      waist: p.waist.length > 0 ? p.waist : undefined,
      hips: p.hips.length > 0 ? p.hips : undefined,
      image: p.imageDataUrl,
      selected: true,
      isCustom: true,
    };
    setModels((prev) => [...prev.map((m) => ({ ...m, selected: false })), record]);
    setFormError(null);
  }, []);

  const garmentsReady =
    garmentMode === "two_piece"
      ? Boolean(topPreview && bottomPreview)
      : Boolean(onePreview);

  const canStart = Boolean(selectedModel && garmentsReady);

  const handleStart = () => {
    if (!selectedModel) {
      setFormError(t("validationNeedModel"));
      return;
    }
    if (!garmentsReady) {
      setFormError(t("validationNeedGarment"));
      return;
    }
    setFormError(null);
    restoreRightRef.current = rightPanel === "models" ? "models" : "idle";
    setRightPanel("loading");
    if (loadingTimerRef.current != null) window.clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = window.setTimeout(() => {
      setRightPanel(restoreRightRef.current);
      loadingTimerRef.current = undefined;
    }, 3200);
  };

  const applyDemoTop = () => {
    if (topPreview?.startsWith("blob:")) URL.revokeObjectURL(topPreview);
    setTopPreview(DEMO_TOP);
    setFormError(null);
  };

  const applyDemoBottom = () => {
    if (bottomPreview?.startsWith("blob:")) URL.revokeObjectURL(bottomPreview);
    setBottomPreview(DEMO_BOTTOM);
    setFormError(null);
  };

  const applyDemoOne = () => {
    if (onePreview?.startsWith("blob:")) URL.revokeObjectURL(onePreview);
    setOnePreview(DEMO_ONE);
    setFormError(null);
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

      <div className={styles.layout}>
        <aside className={styles.leftPanel}>
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
                      if (f?.type.startsWith("image/")) setBlobPreview(setTopPreview, topPreview, f);
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
                          if (f) setBlobPreview(setTopPreview, topPreview, f);
                        }}
                      />
                      <label htmlFor={topInputId} className={styles.uploadHint} style={{ cursor: "pointer" }}>
                        {t("uploadHint")}
                      </label>
                      {topPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={topPreview} alt="" className={styles.uploadPreview} />
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
                        setBlobPreview(setBottomPreview, bottomPreview, f);
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
                          if (f) setBlobPreview(setBottomPreview, bottomPreview, f);
                        }}
                      />
                      <label htmlFor={bottomInputId} className={styles.uploadHint} style={{ cursor: "pointer" }}>
                        {t("uploadHint")}
                      </label>
                      {bottomPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bottomPreview} alt="" className={styles.uploadPreview} />
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
                    if (f?.type.startsWith("image/")) setBlobPreview(setOnePreview, onePreview, f);
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
                        if (f) setBlobPreview(setOnePreview, onePreview, f);
                      }}
                    />
                    <label htmlFor={oneInputId} className={styles.uploadHint} style={{ cursor: "pointer" }}>
                      {t("uploadHint")}
                    </label>
                    {onePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={onePreview} alt="" className={styles.uploadPreview} />
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

          <button
            type="button"
            className={styles.btnStart}
            disabled={!canStart}
            onClick={handleStart}
          >
            <span aria-hidden>✨</span>
            {t("startFitting")}
          </button>

          <p className={styles.disclaimer}>{t("disclaimer")}</p>
        </aside>

        <section className={styles.rightPanel} aria-live="polite">
          {rightPanel !== "loading" ? (
            <header className={styles.rightHeader}>
              <div className={styles.rightTitleWrap}>
                <p className={styles.rightTitle}>
                  {rightPanel === "models" ? t("modelPickerTitle") : t("emptyRightTitle")}
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
                ) : null}
              </div>
            </header>
          ) : null}

          {rightPanel === "idle" ? (
            <div className={styles.rightBody}>
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>{t("emptyRightTitle")}</p>
                <p className={styles.emptyHint}>{t("emptyRightHint")}</p>
              </div>
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
            <div className={styles.loadingWrap}>
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
