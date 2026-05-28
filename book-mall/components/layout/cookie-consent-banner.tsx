"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  hasCookieConsentDecision,
  writeCookieConsent,
  type CookieConsentRecord,
} from "@/lib/cookie-consent";

function saveAndClose(record: CookieConsentRecord, onDone: () => void) {
  writeCookieConsent(record);
  onDone();
}

export function CookieConsentBanner() {
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setOpen(!hasCookieConsentDecision());
  }, []);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
    >
      <div className="mx-auto max-w-3xl rounded-lg border border-neutral-200 bg-white p-5 text-neutral-900 shadow-2xl sm:p-6">
        <h2
          id="cookie-consent-title"
          className="text-base font-semibold tracking-tight text-neutral-900"
        >
          我们重视您的隐私
        </h2>
        <p
          id="cookie-consent-desc"
          className="mt-2 text-sm leading-relaxed text-neutral-700"
        >
          我们使用 Cookie 来提升您的浏览体验、投放个性化广告或内容，并分析网站流量。点击「全部接受」，即表示您同意我们使用
          Cookie。详见{" "}
          <Link
            href="/pricing-disclosure#billing-policy"
            className="font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-600"
          >
            价格与计费说明
          </Link>
          中的相关条款。
        </p>

        {customize ? (
          <div className="mt-4 space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <label className="flex items-start gap-3 opacity-70">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-neutral-900">必要 Cookie</span>
                <span className="mt-0.5 block text-neutral-600">
                  用于登录、安全与基础功能，无法关闭。
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-neutral-900">分析 Cookie</span>
                <span className="mt-0.5 block text-neutral-600">
                  帮助我们了解访问与使用情况。
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-neutral-900">营销 Cookie</span>
                <span className="mt-0.5 block text-neutral-600">
                  用于个性化内容与广告。
                </span>
              </span>
            </label>
            <Button
              type="button"
              className="w-full bg-neutral-900 text-white hover:bg-neutral-800"
              onClick={() =>
                saveAndClose(
                  {
                    choice: "custom",
                    analytics,
                    marketing,
                    decidedAt: new Date().toISOString(),
                  },
                  close,
                )
              }
            >
              保存偏好
            </Button>
          </div>
        ) : null}

        <div
          className={cn(
            "mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-stretch",
            customize && "mt-4",
          )}
        >
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"
            onClick={() => setCustomize((v) => !v)}
          >
            定制
          </Button>
          <Button
            type="button"
            className="flex-1 bg-neutral-900 text-white hover:bg-neutral-800"
            onClick={() =>
              saveAndClose(
                {
                  choice: "rejected",
                  analytics: false,
                  marketing: false,
                  decidedAt: new Date().toISOString(),
                },
                close,
              )
            }
          >
            全部拒绝
          </Button>
          <Button
            type="button"
            className="flex-1 bg-neutral-900 text-white hover:bg-neutral-800"
            onClick={() =>
              saveAndClose(
                {
                  choice: "accepted",
                  analytics: true,
                  marketing: true,
                  decidedAt: new Date().toISOString(),
                },
                close,
              )
            }
          >
            全部接受
          </Button>
        </div>
      </div>
    </div>
  );
}
