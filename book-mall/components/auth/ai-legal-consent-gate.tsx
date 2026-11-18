"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import {
  AiLegalConsentCheckboxes,
  type AiLegalConsentChecks,
  isAiLegalConsentChecksComplete,
} from "@/components/legal/ai-legal-consent-checkboxes";
import { submitAiLegalConsent } from "@/lib/auth/submit-ai-legal-consent-client";

const EXEMPT_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/legal",
  "/legacy",
  "/dev",
  "/invite",
  "/r",
];

function isExemptPath(pathname: string): boolean {
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AiLegalConsentGate() {
  const pathname = usePathname() ?? "";
  const { data: session, status, update } = useSession();
  const [checks, setChecks] = useState<AiLegalConsentChecks>({
    userAgreement: false,
    appPermissions: false,
    privacyPolicy: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsGate =
    status === "authenticated" &&
    session?.user &&
    session.user.aiLegalConsentComplete === false &&
    !isExemptPath(pathname);

  useEffect(() => {
    if (!needsGate) {
      setChecks({
        userAgreement: false,
        appPermissions: false,
        privacyPolicy: false,
      });
      setError(null);
    }
  }, [needsGate]);

  const onConfirm = useCallback(async () => {
    if (!isAiLegalConsentChecksComplete(checks)) {
      setError("请分别勾选三份法律文档");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await submitAiLegalConsent();
      if (!res.ok) {
        setError(res.error ?? "保存失败");
        return;
      }
      await update({ aiLegalConsentComplete: true });
    } finally {
      setSaving(false);
    }
  }, [checks, update]);

  if (!needsGate) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-legal-gate-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-neutral-950">
        <h2
          id="ai-legal-gate-title"
          className="text-lg font-semibold text-neutral-900 dark:text-neutral-50"
        >
          请阅读并同意法律文档
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          为符合监管要求并保障您的权益，请先分别勾选下列三份文档后继续。勾选时间将记为阅读与同意时间。
        </p>
        <div className="mt-4">
          <AiLegalConsentCheckboxes value={checks} onChange={setChecks} disabled={saving} />
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-4 w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          disabled={saving || !isAiLegalConsentChecksComplete(checks)}
          onClick={() => void onConfirm()}
        >
          {saving ? "保存中…" : "同意并继续"}
        </button>
      </div>
    </div>
  );
}