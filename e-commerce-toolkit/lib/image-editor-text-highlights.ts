import type { CSSProperties } from "react";

export const IMAGE_EDITOR_HIGHLIGHTS: Array<{ id: string }> = [
  { id: "none" },
  { id: "marker" },
  { id: "pill" },
  { id: "bar" },
  { id: "underline" },
  { id: "underline-thick" },
  { id: "wavy" },
  { id: "dotted" },
  { id: "dashed" },
  { id: "double" },
  { id: "box" },
  { id: "box-round" },
  { id: "circle" },
  { id: "dashed-box" },
  { id: "scribble" },
  { id: "dots" },
  { id: "marker-soft" },
  { id: "outline-round" },
  { id: "wavy-thick" },
  { id: "bracket" },
  { id: "dash-under" },
];

export const IMAGE_EDITOR_HIGHLIGHT_DEFAULT_COLOR = "#f48cd4";

export function imageEditorHighlightStyle(id: string | undefined, color: string | undefined): CSSProperties | null {
  if (!id || id === "none") return null;
  const ink = color && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : IMAGE_EDITOR_HIGHLIGHT_DEFAULT_COLOR;
  const soft = `${ink}55`;
  const base: CSSProperties = { boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" };
  switch (id) {
    case "marker":
      return { ...base, backgroundColor: soft, padding: "0 0.12em" };
    case "pill":
      return { ...base, backgroundColor: ink, color: "#1d1d1f", borderRadius: "0.45em", padding: "0.02em 0.28em" };
    case "bar":
      return { ...base, backgroundImage: `linear-gradient(transparent 58%, ${ink} 58%)` };
    case "underline":
      return { textDecoration: "underline", textDecorationColor: ink, textDecorationThickness: "0.08em", textUnderlineOffset: "0.16em" };
    case "underline-thick":
      return { textDecoration: "underline", textDecorationColor: ink, textDecorationThickness: "0.18em", textUnderlineOffset: "0.08em" };
    case "wavy":
      return { textDecoration: "underline wavy", textDecorationColor: ink, textDecorationThickness: "0.08em", textUnderlineOffset: "0.18em" };
    case "dotted":
      return { textDecoration: "underline dotted", textDecorationColor: ink, textDecorationThickness: "0.14em", textUnderlineOffset: "0.2em" };
    case "dashed":
      return { textDecoration: "underline dashed", textDecorationColor: ink, textDecorationThickness: "0.1em", textUnderlineOffset: "0.18em" };
    case "double":
      return { textDecoration: "underline double", textDecorationColor: ink, textDecorationThickness: "0.08em", textUnderlineOffset: "0.14em" };
    case "box":
      return { ...base, border: `0.08em solid ${ink}`, padding: "0.04em 0.16em" };
    case "box-round":
      return { ...base, border: `0.08em solid ${ink}`, borderRadius: "0.35em", padding: "0.04em 0.22em" };
    case "circle":
      return { ...base, border: `0.08em solid ${ink}`, borderRadius: "999px", padding: "0.04em 0.35em" };
    case "dashed-box":
      return { ...base, border: `0.08em dashed ${ink}`, borderRadius: "0.2em", padding: "0.06em 0.18em" };
    case "scribble":
      return { textDecoration: "underline wavy", textDecorationColor: ink, textDecorationThickness: "0.12em", textUnderlineOffset: "0.02em" };
    case "dots":
      return { ...base, backgroundImage: `radial-gradient(circle, ${ink} 0.08em, transparent 0.09em)`, backgroundSize: "0.35em 0.35em", backgroundPosition: "center bottom", backgroundRepeat: "repeat-x", paddingBottom: "0.2em" };
    case "marker-soft":
      return { ...base, backgroundColor: `${ink}33`, borderRadius: "0.2em", padding: "0.04em 0.16em" };
    case "outline-round":
      return { ...base, boxShadow: `inset 0 0 0 0.08em ${ink}`, borderRadius: "0.55em", padding: "0.06em 0.28em" };
    case "wavy-thick":
      return { textDecoration: "underline wavy", textDecorationColor: ink, textDecorationThickness: "0.16em", textUnderlineOffset: "0.12em" };
    case "bracket":
      return { ...base, borderLeft: `0.12em solid ${ink}`, borderRight: `0.12em solid ${ink}`, padding: "0 0.2em" };
    case "dash-under":
      return { ...base, borderBottom: `0.1em dashed ${ink}`, paddingBottom: "0.06em" };
    default:
      return null;
  }
}
