import type { ReactElement } from "react";

/** 订阅 / 充值模拟收银页共用的占位二维码（非真实收款码） */
export function FakeQrPlaceholder({ size = 200 }: { size?: number }) {
  const cells = 15;
  const pattern = (r: number, c: number) =>
    (r * c + r + c) % 3 === 0 ||
    r < 3 ||
    c < 3 ||
    r >= cells - 3 ||
    c >= cells - 3;

  const step = size / cells;
  const rects: ReactElement[] = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (!pattern(r, c)) continue;
      rects.push(
        <rect
          key={`${r}-${c}`}
          x={c * step}
          y={r * step}
          width={step - 0.5}
          height={step - 0.5}
          className="fill-foreground"
        />,
      );
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-lg border border-border bg-muted/40"
      aria-hidden
    >
      {rects}
    </svg>
  );
}
