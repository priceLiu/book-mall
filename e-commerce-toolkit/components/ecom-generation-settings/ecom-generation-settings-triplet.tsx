"use client";

import {
  ECOM_COUNTRY_OPTIONS,
  ECOM_LANGUAGE_OPTIONS,
  ECOM_PLATFORM_OPTIONS,
} from "@/lib/ecom-generation-settings/constants";
import { cn } from "@/lib/utils";

const selectClass =
  "w-full rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2 py-1.5 text-[11px] text-[#1d1d1f]";

type Props = {
  platform: string;
  country: string;
  language: string;
  onPlatformChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

/** 生成设置第一行：平台 · 国家 · 语种（与稿图一致，可滚动长列表） */
export function EcomGenerationSettingsTriplet({
  platform,
  country,
  language,
  onPlatformChange,
  onCountryChange,
  onLanguageChange,
  disabled,
  className,
}: Props) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <select
        className={selectClass}
        value={platform}
        disabled={disabled}
        aria-label="平台"
        onChange={(e) => onPlatformChange(e.target.value)}
      >
        {ECOM_PLATFORM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={country}
        disabled={disabled}
        aria-label="国家"
        onChange={(e) => onCountryChange(e.target.value)}
      >
        {ECOM_COUNTRY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={language}
        disabled={disabled}
        aria-label="语种"
        onChange={(e) => onLanguageChange(e.target.value)}
      >
        {ECOM_LANGUAGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
