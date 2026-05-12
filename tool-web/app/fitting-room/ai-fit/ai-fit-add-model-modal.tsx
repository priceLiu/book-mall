"use client";

import { useEffect, useRef, useState } from "react";
import type { AiFitMsgKey } from "@/messages";
import styles from "./ai-fit.module.css";

export type AddModelPayload = {
  name: string;
  style: string;
  height: string;
  weight: string;
  body: string;
  bust: string;
  waist: string;
  hips: string;
  imageDataUrl: string;
};

export function AiFitAddModelModal({
  open,
  onClose,
  onConfirm,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: AddModelPayload) => void;
  t: (key: AiFitMsgKey) => string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [style, setStyle] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [body, setBody] = useState("");
  const [bust, setBust] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setStyle("");
    setHeight("");
    setWeight("");
    setBody("");
    setBust("");
    setWaist("");
    setHips("");
    setImageDataUrl(null);
    setErr(null);
    if (fileRef.current) fileRef.current.value = "";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>("input[name='model-name']")?.focus();
  }, [open]);

  const onPickFile = (file: File | null) => {
    setErr(null);
    if (!file || !file.type.startsWith("image/")) {
      setImageDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") setImageDataUrl(r);
    };
    reader.readAsDataURL(file);
  };

  const submit = () => {
    const n = name.trim();
    if (!n) {
      setErr(t("validationNeedName"));
      return;
    }
    if (!imageDataUrl) {
      setErr(t("validationNeedPhoto"));
      return;
    }
    setErr(null);
    onConfirm({
      name: n,
      style: style.trim(),
      height: height.trim(),
      weight: weight.trim(),
      body: body.trim(),
      bust: bust.trim(),
      waist: waist.trim(),
      hips: hips.trim(),
      imageDataUrl,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={styles.modalPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-fit-add-model-title"
      >
        <h2 id="ai-fit-add-model-title" className={styles.modalTitle}>
          {t("modalAddTitle")}
        </h2>

        <div className={styles.modalGrid}>
          <label className={styles.modalField}>
            <span className={styles.modalLabel}>{t("modalImageLabel")}</span>
            <span className={styles.modalHint}>{t("modalImageHint")}</span>
            <div className={styles.modalFileWrap}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.modalFileInput}
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-upload data URL
              <img src={imageDataUrl} alt="" className={styles.modalPreviewImg} />
            ) : null}
          </label>

          <label className={styles.modalField}>
            <span className={styles.modalLabel}>{t("modelName")}</span>
            <input
              name="model-name"
              className={styles.modalInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className={styles.modalField}>
            <span className={styles.modalLabel}>{t("style")}</span>
            <input
              className={styles.modalInput}
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              autoComplete="off"
            />
          </label>

          <div className={styles.modalRow2}>
            <label className={styles.modalField}>
              <span className={styles.modalLabel}>{t("height")}</span>
              <input
                className={styles.modalInput}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </label>
            <label className={styles.modalField}>
              <span className={styles.modalLabel}>{t("weight")}</span>
              <input
                className={styles.modalInput}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
          </div>

          <label className={styles.modalField}>
            <span className={styles.modalLabel}>{t("bodyType")}</span>
            <input className={styles.modalInput} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>

          <div className={styles.modalRow3}>
            <label className={styles.modalField}>
              <span className={styles.modalLabel}>{t("bust")}</span>
              <input className={styles.modalInput} value={bust} onChange={(e) => setBust(e.target.value)} />
            </label>
            <label className={styles.modalField}>
              <span className={styles.modalLabel}>{t("waist")}</span>
              <input className={styles.modalInput} value={waist} onChange={(e) => setWaist(e.target.value)} />
            </label>
            <label className={styles.modalField}>
              <span className={styles.modalLabel}>{t("hips")}</span>
              <input className={styles.modalInput} value={hips} onChange={(e) => setHips(e.target.value)} />
            </label>
          </div>
        </div>

        {err ? <p className={styles.modalErr}>{err}</p> : null}

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            {t("modalCancel")}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={submit}>
            {t("modalConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
