"use client";

import { useEffect, useState } from "react";

import { pickAuthShowcaseHero } from "@/lib/auth/shuffle-portal-showcase";
import type { PortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";

const AUTH_SHOWCASE_LAST_URL_KEY = "auth-v2-showcase-last-url";

export function AuthHomeV2Showcase() {
  const [hero, setHero] = useState<PortalFilmShowcaseMedia | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          "/api/canvas/projects/portal-film-showcase?limit=200&for=auth",
          { cache: "no-store" },
        );
        const data = (await res.json()) as { items?: PortalFilmShowcaseMedia[] };
        if (cancelled) return;
        const raw = Array.isArray(data.items) ? data.items : [];
        let excludeUrl: string | null = null;
        try {
          excludeUrl = sessionStorage.getItem(AUTH_SHOWCASE_LAST_URL_KEY);
        } catch {
          /* private mode */
        }
        const picked = pickAuthShowcaseHero(raw, { excludeUrl });
        if (picked?.url) {
          try {
            sessionStorage.setItem(AUTH_SHOWCASE_LAST_URL_KEY, picked.url.trim());
          } catch {
            /* private mode */
          }
        }
        setHero(picked);
      } catch {
        if (!cancelled) setHero(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = hero === undefined;

  return (
    <div className="auth-v2-showcase">
      <div className="auth-v2-showcase-hero">
        {loading ? (
          <div className="auth-v2-showcase-skeleton" aria-hidden />
        ) : hero ? (
          <>
            {hero.kind === "video" ? (
              <video
                className="auth-v2-showcase-media"
                src={hero.url}
                poster={hero.posterUrl}
                muted
                playsInline
                loop
                autoPlay
                preload="metadata"
                aria-label={hero.projectName}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="auth-v2-showcase-media"
                src={hero.url}
                alt={hero.projectName}
                loading="eager"
                decoding="async"
              />
            )}
          </>
        ) : (
          <div className="auth-v2-showcase-empty">
            <p>暂无精选成片</p>
            <p className="auth-v2-showcase-empty-hint">门户影视案例上架后将在此展示</p>
          </div>
        )}
      </div>
    </div>
  );
}