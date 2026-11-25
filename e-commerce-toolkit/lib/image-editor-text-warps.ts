export const IMAGE_EDITOR_WARPS: Array<{ id: string; dotted?: boolean }> = [
  { id: "none" },
  { id: "arc", dotted: true },
  { id: "wave", dotted: true },
  { id: "circle", dotted: true },
  { id: "round-rect", dotted: true },
  { id: "triangle", dotted: true },
  { id: "square", dotted: true },
  { id: "pentagon", dotted: true },
  { id: "heart", dotted: true },
  { id: "arch" },
  { id: "smile" },
  { id: "flag" },
  { id: "bowl" },
  { id: "dome" },
  { id: "hex" },
  { id: "oval" },
  { id: "wedge-l" },
  { id: "wedge-r" },
  { id: "trapezoid" },
];

export function warpBoxSize(id: string, text: string, fontPx: number): { w: number; h: number } {
  const chars = Math.max(2, Array.from(text).length);
  const w = Math.max(fontPx * 3.6, chars * fontPx * 0.92);
  const tall = id === "circle" || id === "heart" || id === "hex" || id === "pentagon" || id === "square" || id === "round-rect";
  const h = Math.round(fontPx * (tall ? 3.2 : 2.15));
  return tall ? { w: Math.max(w, h), h: Math.max(w, h) } : { w, h };
}

export function warpPathD(id: string, w: number, h: number): string | null {
  const pad = Math.max(6, Math.round(Math.min(w, h) * 0.06));
  const left = pad;
  const right = w - pad;
  const midX = w / 2;
  const midY = h / 2;
  switch (id) {
    case "arc":
      return `M ${left} ${h * 0.78} Q ${midX} ${h * 0.12} ${right} ${h * 0.78}`;
    case "wave":
      return `M ${left} ${midY} C ${w * 0.22} ${h * 0.12}, ${w * 0.32} ${h * 0.88}, ${midX} ${midY} S ${w * 0.78} ${h * 0.12}, ${right} ${midY}`;
    case "circle": {
      const r = Math.min(w, h) * 0.36;
      return `M ${midX - r} ${midY} A ${r} ${r} 0 1 1 ${midX + r} ${midY} A ${r} ${r} 0 1 1 ${midX - r} ${midY}`;
    }
    case "round-rect":
      return `M ${left + 16} ${h * 0.72} H ${right - 16} Q ${right} ${h * 0.72} ${right} ${h * 0.5} Q ${right} ${h * 0.28} ${right - 16} ${h * 0.28} H ${left + 16} Q ${left} ${h * 0.28} ${left} ${h * 0.5} Q ${left} ${h * 0.72} ${left + 16} ${h * 0.72}`;
    case "triangle":
      return `M ${left} ${h * 0.78} L ${midX} ${h * 0.18} L ${right} ${h * 0.78} Z`;
    case "square":
      return `M ${left} ${h * 0.75} H ${right} V ${h * 0.25} H ${left} Z`;
    case "pentagon":
      return `M ${midX} ${h * 0.14} L ${right - 8} ${h * 0.4} L ${w * 0.78} ${h * 0.84} L ${w * 0.22} ${h * 0.84} L ${left + 8} ${h * 0.4} Z`;
    case "heart":
      return `M ${midX} ${h * 0.78} C ${left} ${h * 0.45}, ${left} ${h * 0.18}, ${midX} ${h * 0.32} C ${right} ${h * 0.18}, ${right} ${h * 0.45}, ${midX} ${h * 0.78}`;
    case "arch":
      return `M ${left} ${h * 0.8} Q ${midX} ${h * 0.05} ${right} ${h * 0.8}`;
    case "smile":
      return `M ${left} ${h * 0.28} Q ${midX} ${h * 0.95} ${right} ${h * 0.28}`;
    case "flag":
      return `M ${left} ${h * 0.45} Q ${w * 0.25} ${h * 0.15} ${midX} ${h * 0.45} T ${right} ${h * 0.45}`;
    case "bowl":
      return `M ${left} ${h * 0.22} Q ${midX} ${h * 0.9} ${right} ${h * 0.22}`;
    case "dome":
      return `M ${left} ${h * 0.72} A ${w * 0.42} ${h * 0.55} 0 0 1 ${right} ${h * 0.72}`;
    case "hex":
      return `M ${w * 0.28} ${h * 0.18} H ${w * 0.72} L ${right - 6} ${midY} L ${w * 0.72} ${h * 0.82} H ${w * 0.28} L ${left + 6} ${midY} Z`;
    case "oval":
      return `M ${left} ${midY} A ${(right - left) / 2} ${h * 0.32} 0 1 1 ${right} ${midY} A ${(right - left) / 2} ${h * 0.32} 0 1 1 ${left} ${midY}`;
    case "wedge-l":
      return `M ${left} ${h * 0.25} L ${right} ${h * 0.55} L ${right} ${h * 0.8} L ${left} ${h * 0.62} Z`;
    case "wedge-r":
      return `M ${left} ${h * 0.55} L ${right} ${h * 0.25} L ${right} ${h * 0.62} L ${left} ${h * 0.8} Z`;
    case "trapezoid":
      return `M ${w * 0.22} ${h * 0.28} H ${w * 0.78} L ${right - 4} ${h * 0.78} H ${left + 4} Z`;
    default:
      return null;
  }
}

/** 缩略图用的小路径，坐标系 0–48 */
export function warpIconD(id: string): string | null {
  return warpPathD(id, 48, 48);
}
