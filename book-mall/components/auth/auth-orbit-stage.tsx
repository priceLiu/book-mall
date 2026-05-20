"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  OrbitPathRings,
  Ripple,
  TechOrbitDisplay,
} from "@/components/auth/animated-auth-ui";
import {
  assignOrbitRadii,
  LOGIN_ORBIT_ICONS,
} from "@/components/auth/auth-orbit-icons";

/** 背景涟漪 5 圈，按舞台短边铺满 */
const RIPPLE_RING_COUNT = 5;
const RIPPLE_OUTER_RATIO = 0.88;
const RIPPLE_INNER_RATIO = 0.32;

type Props = {
  brandingText?: string;
};

export function AuthOrbitStage({ brandingText = "智选 AI MALL" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [layoutMin, setLayoutMin] = useState(640);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { clientWidth, clientHeight } = el;
      setLayoutMin(Math.max(Math.min(clientWidth, clientHeight), 360));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { rippleMain, rippleStep, ringRadiiPx, iconsArray, titleClass, iconScale } =
    useMemo(() => {
      const outerDiameter = layoutMin * RIPPLE_OUTER_RATIO;
      const innerDiameter = outerDiameter * RIPPLE_INNER_RATIO;
      const step =
        (outerDiameter - innerDiameter) / Math.max(RIPPLE_RING_COUNT - 1, 1);

      const ringRadii = Array.from({ length: RIPPLE_RING_COUNT }, (_, i) =>
        Math.round((innerDiameter + i * step) / 2)
      );

      const scale = layoutMin / 640;
      const iconScale = Math.max(1.55, scale * 1.2);

      const titleClass =
        layoutMin >= 720
          ? "text-7xl"
          : layoutMin >= 560
            ? "text-6xl"
            : layoutMin >= 420
              ? "text-5xl"
              : "text-4xl";

      return {
        rippleMain: Math.round(innerDiameter),
        rippleStep: Math.round(step),
        ringRadiiPx: ringRadii,
        iconsArray: assignOrbitRadii(LOGIN_ORBIT_ICONS, ringRadii),
        titleClass,
        iconScale,
      };
    }, [layoutMin]);

  return (
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden bg-neutral-100 transition-colors duration-300 dark:bg-[#020617]"
    >
      <Ripple
        mainCircleSize={rippleMain}
        rippleStep={rippleStep}
        numCircles={RIPPLE_RING_COUNT}
        className="inset-0 z-0 max-w-none"
      />
      <OrbitPathRings radiiPx={ringRadiiPx} className="z-[5]" />
      <div
        className="absolute inset-0 z-10"
        style={{ "--orbit-icon-scale": iconScale } as CSSProperties}
      >
        <TechOrbitDisplay
          iconsArray={iconsArray}
          text={brandingText}
          titleClassName={titleClass}
        />
      </div>
    </div>
  );
}
