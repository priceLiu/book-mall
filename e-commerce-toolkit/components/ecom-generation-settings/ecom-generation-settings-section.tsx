"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { EcomDetailTemplateSelect } from "@/components/ecom-generation-settings/ecom-detail-template-select";
import { EcomGenerationSettingsTriplet } from "@/components/ecom-generation-settings/ecom-generation-settings-triplet";
import {
  ecomOptionLabel,
  normalizeEcomCountryValue,
  normalizeEcomLanguageValue,
  normalizeEcomPlatformValue,
  ECOM_COUNTRY_OPTIONS,
  ECOM_LANGUAGE_OPTIONS,
  ECOM_PLATFORM_OPTIONS,
} from "@/lib/ecom-generation-settings/constants";
import {
  detailTemplateToDisplayRatio,
  detailTemplateToImageSize,
  DEFAULT_ECOM_DETAIL_TEMPLATE_ID,
  type EcomDetailTemplateId,
} from "@/lib/ecom-generation-settings/detail-template";
import { cn } from "@/lib/utils";

export type EcomGenerationSettingsValue = {
  platform: string;
  country: string;
  language: string;
  detailTemplateId?: string;
};

type Props = {
  value: EcomGenerationSettingsValue;
  onChange: (patch: Partial<EcomGenerationSettingsValue>) => void;
  /** AI 详情页展示模板/比例块 */
  showDetailTemplate?: boolean;
  disabled?: boolean;
  defaultOpen?: boolean;
  className?: string;
};

export function buildGenerationSettingsPatchFromTriplet(
  patch: Partial<EcomGenerationSettingsValue>,
): Partial<EcomGenerationSettingsValue> {
  const next = { ...patch };
  if (next.platform !== undefined) {
    next.platform = normalizeEcomPlatformValue(next.platform);
  }
  if (next.country !== undefined) {
    next.country = normalizeEcomCountryValue(next.country);
  }
  if (next.language !== undefined) {
    next.language = normalizeEcomLanguageValue(next.language);
  }
  return next;
}

/** 可折叠「生成设置」区块（平台/国家/语种 + 可选详情页模板） */
export function EcomGenerationSettingsSection({
  value,
  onChange,
  showDetailTemplate,
  disabled,
  defaultOpen = true,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const platform = normalizeEcomPlatformValue(value.platform);
  const country = normalizeEcomCountryValue(value.country);
  const language = normalizeEcomLanguageValue(value.language);

  return (
    <section className={cn("mb-3 rounded-xl border border-[#e8e8ed] bg-white", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-xs font-semibold">生成设置</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? (
        <div className="space-y-2 border-t border-[#e8e8ed] px-3 py-3">
          <EcomGenerationSettingsTriplet
            platform={platform}
            country={country}
            language={language}
            disabled={disabled}
            onPlatformChange={(v) =>
              onChange(
                buildGenerationSettingsPatchFromTriplet({
                  platform: v,
                }),
              )
            }
            onCountryChange={(v) =>
              onChange(
                buildGenerationSettingsPatchFromTriplet({
                  country: v,
                }),
              )
            }
            onLanguageChange={(v) =>
              onChange(
                buildGenerationSettingsPatchFromTriplet({
                  language: v,
                }),
              )
            }
          />
          {showDetailTemplate ? (
            <EcomDetailTemplateSelect
              disabled={disabled}
              value={value.detailTemplateId ?? DEFAULT_ECOM_DETAIL_TEMPLATE_ID}
              onChange={(id: EcomDetailTemplateId) =>
                onChange({ detailTemplateId: id })
              }
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** 商品套图 brief 文案辅助（平台 label） */
export function generationPlatformLabel(code: string): string {
  return ecomOptionLabel(ECOM_PLATFORM_OPTIONS, normalizeEcomPlatformValue(code), code);
}

export function generationCountryLabel(code: string): string {
  return ecomOptionLabel(ECOM_COUNTRY_OPTIONS, normalizeEcomCountryValue(code), code);
}

export function generationLanguageLabel(code: string): string {
  return ecomOptionLabel(ECOM_LANGUAGE_OPTIONS, normalizeEcomLanguageValue(code), code);
}

export function detailTemplateSettingsPatch(templateId: EcomDetailTemplateId): {
  imageRatio: "1:1" | "3:4" | "4:5" | "9:16" | "16:9";
  imageSize: string;
} {
  return {
    imageRatio: detailTemplateToDisplayRatio(templateId),
    imageSize: detailTemplateToImageSize(templateId),
  };
}
