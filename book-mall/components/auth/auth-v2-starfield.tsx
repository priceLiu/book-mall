"use client";

import { useMemo } from "react";

const STAR_COUNT = 68;

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = {
  id: number;
  left: string;
  top: string;
  size: number;
  delay: string;
  duration: string;
  oMin: number;
  oMax: number;
  sparkle: boolean;
};

/** 注册页黑底 · 零散星点闪烁（纯装饰） */
export function AuthV2Starfield() {
  const stars = useMemo((): Star[] => {
    const rnd = mulberry32(0x9e3a_4c21);
    return Array.from({ length: STAR_COUNT }, (_, i) => {
      const sparkle = rnd() > 0.88;
      const size = sparkle ? 2.4 + rnd() * 1.4 : 1 + rnd() * 2;
      return {
        id: i,
        left: `${(rnd() * 100).toFixed(2)}%`,
        top: `${(rnd() * 100).toFixed(2)}%`,
        size,
        delay: `${(rnd() * 6).toFixed(2)}s`,
        duration: `${(2 + rnd() * 4.5).toFixed(2)}s`,
        oMin: 0.08 + rnd() * 0.22,
        oMax: 0.45 + rnd() * 0.5,
        sparkle,
      };
    });
  }, []);

  return (
    <div className="auth-v2-starfield" aria-hidden>
      {stars.map((s) => (
        <span
          key={s.id}
          className={s.sparkle ? "auth-v2-star auth-v2-star--sparkle" : "auth-v2-star"}
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            ["--star-delay" as string]: s.delay,
            ["--star-dur" as string]: s.duration,
            ["--star-o-min" as string]: String(s.oMin),
            ["--star-o-max" as string]: String(s.oMax),
          }}
        />
      ))}
    </div>
  );
}