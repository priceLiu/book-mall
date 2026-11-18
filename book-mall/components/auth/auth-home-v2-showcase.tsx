"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { pickAuthShowcaseHero } from "@/lib/auth/shuffle-portal-showcase";
import type { PortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";

export function AuthHomeV2Showcase() {
  const [hero, setHero] = useState<PortalFilmShowcaseMedia | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/canvas/projects/portal-film-showcase?limit=48", {
          cache: "no-store",
        });
        const data = (await res.json()) as { items?: PortalFilmShowcaseMedia[] };
        if (cancelled) return;
        const raw = Array.isArray(data.items) ? data.items : [];
        setHero(pickAuthShowcaseHero(raw));
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
      <Link href="/" className="auth-v2-showcase-back" aria-label="返回首页">
        ←
      </Link>
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