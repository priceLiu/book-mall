"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FittingRoomLocaleProvider,
  useFittingRoomLocale,
} from "@/components/fitting-room-locale-context";
import { useToolsSession } from "@/components/tool-shell-client";
import { FittingRoomGallery } from "./fitting-room-gallery";
import {
  LocaleSwitcher,
  SexFilterToolbar,
  type SexFilterValue,
} from "./fitting-room-toolbar";
import styles from "./fitting-room.module.css";

export function FittingRoomPageClient({
  renewHref,
  mainOrigin,
}: {
  renewHref: string | null;
  mainOrigin: string | null;
}) {
  return (
    <FittingRoomLocaleProvider>
      <FittingRoomPageBody renewHref={renewHref} mainOrigin={mainOrigin} />
    </FittingRoomLocaleProvider>
  );
}

function FittingRoomPageBody({
  renewHref,
  mainOrigin,
}: {
  renewHref: string | null;
  mainOrigin: string | null;
}) {
  const { t } = useFittingRoomLocale();
  const { loading, session, hasTokenCookie, refetch } = useToolsSession();
  const [sexFilter, setSexFilter] = useState<SexFilterValue>("all");

  const originConfigured =
    typeof mainOrigin === "string" && mainOrigin.trim().length > 0;

  return (
    <>
      <div className={styles.pageHead}>
        <h1>{t("pageTitle")}</h1>
        <div className={styles.pageHeadTools}>
          <LocaleSwitcher />
          {!loading && originConfigured ? (
            <SexFilterToolbar value={sexFilter} onChange={setSexFilter} />
          ) : null}
        </div>
      </div>

      <p className="tw-muted">{t("pageSubtitle")}</p>

      {loading ? (
        <p className="tw-muted" role="status">
          {t("loadingSession")}
        </p>
      ) : null}

      {!loading && !originConfigured ? (
        <div className="tw-note">{t("missingMainOrigin")}</div>
      ) : null}

      {!loading && originConfigured && !hasTokenCookie ? (
        <div className="tw-note">
          <p style={{ margin: "0 0 0.5rem" }}>{t("noTokenLead")}</p>
          <p className="tw-muted" style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
            {t("noTokenOriginHint")}
          </p>
          {renewHref ? (
            <p style={{ margin: 0 }}>
              <Link href={renewHref}>{t("reconnectFitting")}</Link>
            </p>
          ) : null}
          <p className="tw-muted" style={{ margin: "0.75rem 0 0", fontSize: "0.85rem" }}>
            {t("accountHintPrefix")}
            <Link href={`${mainOrigin}/account`}>{t("account")}</Link>
            {" · "}
            <Link href={`${mainOrigin}/admin`}>{t("admin")}</Link>
            {t("accountHintSuffix")}
          </p>
        </div>
      ) : null}

      {!loading && originConfigured && hasTokenCookie && !session.active ? (
        <div className="tw-note">
          <p style={{ margin: "0 0 0.5rem" }}>{t("tokenInvalidLead")}</p>
          <p style={{ margin: "0 0 0.5rem" }}>
            <button
              type="button"
              className="tool-renew tool-renew--link"
              onClick={() => void refetch()}
            >
              {t("retrySync")}
            </button>
            {renewHref ? (
              <>
                {" · "}
                <Link href={renewHref}>{t("reconnectShort")}</Link>
              </>
            ) : null}
          </p>
          <p className="tw-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            <Link href={`${mainOrigin}/account`}>{t("account")}</Link>
            {" · "}
            <Link href={`${mainOrigin}/admin`}>{t("admin")}</Link>
          </p>
        </div>
      ) : null}

      {!loading && originConfigured ? (
        <FittingRoomGallery sexFilter={sexFilter} />
      ) : null}
    </>
  );
}
