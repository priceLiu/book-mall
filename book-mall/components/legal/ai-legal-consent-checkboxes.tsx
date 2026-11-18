"use client";

import Link from "next/link";

import {
  AI_LEGAL_DOCS,
  aiLegalDocPath,
} from "@/lib/legal/ai-legal-catalog";
import { cn } from "@/lib/utils";

export type AiLegalConsentChecks = {
  userAgreement: boolean;
  appPermissions: boolean;
  privacyPolicy: boolean;
};

const CHECK_KEYS: {
  key: keyof AiLegalConsentChecks;
  slug: (typeof AI_LEGAL_DOCS)[number]["slug"];
  label: string;
}[] = [
  { key: "userAgreement", slug: "user-agreement", label: "《智选AI 用户协议》" },
  { key: "appPermissions", slug: "app-permissions", label: "《AI App 应用权限说明》" },
  { key: "privacyPolicy", slug: "privacy-policy", label: "《智选AI 隐私政策》" },
];

export function isAiLegalConsentChecksComplete(checks: AiLegalConsentChecks): boolean {
  return checks.userAgreement && checks.appPermissions && checks.privacyPolicy;
}

type Props = {
  value: AiLegalConsentChecks;
  onChange: (next: AiLegalConsentChecks) => void;
  disabled?: boolean;
  className?: string;
  /** 登录页底部辅助说明 */
  showOtpHint?: boolean;
};

export function AiLegalConsentCheckboxes({
  value,
  onChange,
  disabled,
  className,
  showOtpHint,
}: Props) {
  return (
    <div className={cn("space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 dark:border-neutral-700 dark:bg-neutral-900/40", className)}>
      <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        注册与登录前，请分别勾选下列文档（点击标题可在新窗口查阅全文）。
        {showOtpHint ? (
          <span className="mt-1 block">未注册手机号需先完成注册流程后再登录。</span>
        ) : null}
      </p>
      <ul className="space-y-2">
        {CHECK_KEYS.map((item) => (
          <li key={item.key}>
            <label className="flex cursor-pointer items-start gap-2 text-xs text-neutral-700 dark:text-neutral-200">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-neutral-300"
                checked={value[item.key]}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...value, [item.key]: e.target.checked })
                }
              />
              <span>
                我已阅读并同意{" "}
                <Link
                  href={aiLegalDocPath(item.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.label}
                </Link>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}