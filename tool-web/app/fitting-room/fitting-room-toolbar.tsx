"use client";

import { useFittingRoomLocale } from "@/components/fitting-room-locale-context";
import type { OutfitSex } from "@/lib/fitting-room-types";
import styles from "./fitting-room.module.css";
import { IconFemale, IconFilterAll, IconMale } from "./fitting-room-icons";

export type SexFilterValue = "all" | OutfitSex;

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useFittingRoomLocale();
  return (
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
  );
}

export function SexFilterToolbar({
  value,
  onChange,
}: {
  value: SexFilterValue;
  onChange: (v: SexFilterValue) => void;
}) {
  const { t } = useFittingRoomLocale();

  return (
    <div
      className={styles.filterGroup}
      role="radiogroup"
      aria-label={t("filterGroupAria")}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "all"}
        className={`${styles.filterBtn} ${value === "all" ? styles.filterBtnActive : ""}`}
        aria-label={t("filterAllAria")}
        title={t("filterAllAria")}
        onClick={() => onChange("all")}
      >
        <IconFilterAll />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "male"}
        className={`${styles.filterBtn} ${value === "male" ? styles.filterBtnActive : ""}`}
        aria-label={t("filterMaleAria")}
        title={t("filterMaleAria")}
        onClick={() => onChange("male")}
      >
        <IconMale />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "female"}
        className={`${styles.filterBtn} ${value === "female" ? styles.filterBtnActive : ""}`}
        aria-label={t("filterFemaleAria")}
        title={t("filterFemaleAria")}
        onClick={() => onChange("female")}
      >
        <IconFemale />
      </button>
    </div>
  );
}
