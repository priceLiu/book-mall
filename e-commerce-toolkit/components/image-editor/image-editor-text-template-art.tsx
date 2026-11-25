"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

import type { ImageEditorSellingMark, ImageEditorTextTemplate, ImageEditorTextTemplateKind } from "@/lib/image-editor-text-templates";

const STAR = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";

export type SellingMarkHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const MARK_HANDLE_POS: Record<SellingMarkHandle, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
};

export function decorBoxEm(kind: string | undefined): { w: number; h: number } {
  switch (kind) {
    case "stamp":
      return { w: 4.4, h: 4.4 };
    case "burst":
      return { w: 4.8, h: 4.8 };
    case "bubble":
      return { w: 4.6, h: 2.5 };
    case "frame":
      return { w: 5.2, h: 2.6 };
    case "coil":
      return { w: 4.8, h: 2.3 };
    case "ribbon":
      return { w: 5.2, h: 1.9 };
    case "banner":
      return { w: 5.6, h: 2 };
    case "pill":
      return { w: 4.6, h: 1.8 };
    default:
      return { w: 4.4, h: 2.2 };
  }
}

type ArtProps = {
  kind: ImageEditorTextTemplateKind;
  text: string;
  color: string;
  bg?: string;
  fontPx: number;
  editing?: boolean;
  fill?: boolean;
  inputRef?: (node: HTMLInputElement | null) => void;
  onChange?: (text: string) => void;
  onCommit?: (text: string) => void;
};

export function ShapeTextArt({ kind, text, color, bg, fontPx, editing, fill, inputRef, onChange, onCommit }: ArtProps) {
  const box = decorBoxEm(kind);
  const size = fill ? { width: "100%", height: "100%", fontSize: fontPx } : { width: `${box.w}em`, height: `${box.h}em`, fontSize: fontPx };
  const words = (
    <ArtWords
      text={text}
      color={color}
      editing={editing}
      inputRef={inputRef}
      onChange={onChange}
      onCommit={onCommit}
    />
  );
  if (kind === "stamp") {
    return (
      <div className="grid place-items-center rounded-full border-double text-center font-black" style={{ ...size, color, borderWidth: "0.14em", borderColor: color }}>
        {words}
      </div>
    );
  }
  if (kind === "burst") {
    return (
      <div className="grid place-items-center text-center font-black" style={{ ...size, color, background: bg || color, clipPath: STAR }}>
        {words}
      </div>
    );
  }
  if (kind === "bubble") {
    const fillColor = bg || "#ffffff";
    return (
      <div className="relative font-bold" style={{ width: size.width, height: size.height, fontSize: fontPx, color }}>
        <div className="h-full w-full rounded-[0.7em]" style={{ background: fillColor }} />
        <i
          aria-hidden
          className="absolute left-[18%] block h-[0.48em] w-[0.48em] rotate-45"
          style={{ bottom: "-0.22em", background: fillColor }}
        />
        {words ? <div className="absolute inset-0 grid place-items-center">{words}</div> : null}
      </div>
    );
  }
  if (kind === "frame") {
    return (
      <div className="grid place-items-center font-black" style={{ ...size, color, border: "0.1em solid currentColor", padding: "0.18em" }}>
        <div className="grid h-full w-full place-items-center" style={{ border: "0.05em solid currentColor" }}>
          {words}
        </div>
      </div>
    );
  }
  if (kind === "coil") {
    return (
      <div
        className="grid place-items-center rounded-full border-dashed font-bold"
        style={{ ...size, color, borderWidth: "0.1em", borderColor: color }}
      >
        {words}
      </div>
    );
  }
  if (kind === "banner") {
    return (
      <div className="grid place-items-center rounded-[0.45em] font-black" style={{ ...size, color, background: bg || color }}>
        {words}
      </div>
    );
  }
  if (kind === "pill") {
    return (
      <div className="grid place-items-center rounded-full font-black" style={{ ...size, color, background: bg || color }}>
        {words}
      </div>
    );
  }
  return (
    <div
      className="grid place-items-center font-black"
      style={{
        ...size,
        color: bg ? color : "#ffffff",
        background: bg || color,
        clipPath: "polygon(7% 0, 100% 0, 93% 100%, 0 100%)",
      }}
    >
      {words}
    </div>
  );
}

export function DecorShape({
  kind,
  color,
  bg,
  fontPx,
  boxW,
  boxH,
  active,
  onPointerDown,
  onResize,
}: {
  kind: ImageEditorTextTemplateKind;
  color: string;
  bg?: string;
  fontPx: number;
  boxW?: number;
  boxH?: number;
  active?: boolean;
  onPointerDown?: (event: React.PointerEvent<HTMLSpanElement>) => void;
  onResize?: (handle: SellingMarkHandle, event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const box = decorBoxEm(kind);
  const w = boxW ?? box.w;
  const h = boxH ?? box.h;
  return (
    <span
      data-text-mark="1"
      className="relative inline-flex"
      style={{
        width: `${w}em`,
        height: `${h}em`,
        fontSize: fontPx,
        outline: active ? "2px solid rgba(61,126,255,0.9)" : undefined,
        outlineOffset: 3,
      }}
      onPointerDown={onPointerDown}
    >
      <ShapeTextArt kind={kind} text="" color={color} bg={bg} fontPx={fontPx} fill />
      {active
        ? (Object.keys(MARK_HANDLE_POS) as SellingMarkHandle[]).map((id) => (
            <button
              key={id}
              type="button"
              data-text-handle="1"
              aria-label={`拉伸色块 ${id}`}
              style={{ touchAction: "none" }}
              className={`pointer-events-auto absolute z-30 box-border h-2 w-2 touch-none select-none rounded-[2px] border border-white bg-[#2a2420] shadow-[0_0_0_1px_rgba(42,36,32,0.35)] ${MARK_HANDLE_POS[id]}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                onResize?.(id, event);
              }}
            />
          ))
        : null}
    </span>
  );
}

function ArtWords({
  text,
  color,
  editing,
  inputRef,
  onChange,
  onCommit,
}: {
  text: string;
  color: string;
  editing?: boolean;
  inputRef?: (node: HTMLInputElement | null) => void;
  onChange?: (text: string) => void;
  onCommit?: (text: string) => void;
}) {
  if (!editing) return <span className="leading-none">{text}</span>;
  const chars = Math.max(Array.from(text).length, 1);
  return (
    <input
      ref={inputRef}
      data-text-edit="1"
      value={text}
      size={chars}
      spellCheck={false}
      className="w-auto shrink-0 border-0 bg-[#3d7eff]/25 px-[0.08em] text-center leading-none outline-none"
      style={{ color, fontSize: "1em", boxSizing: "content-box", width: `${chars}em` }}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={(event) => {
        const next = event.target.value.trim() ? event.target.value : text;
        onCommit?.(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
}

export function SellingPointCard({
  mark,
  text,
  fontPx,
  markColor,
  editing,
  startLine = 0,
  onChange,
  onCommit,
}: {
  mark: ImageEditorSellingMark;
  text: string;
  fontPx: number;
  markColor?: string;
  editing?: boolean;
  startLine?: number;
  onChange?: (text: string) => void;
  onCommit?: (text: string) => void;
}) {
  const lines = text.split("\n");
  const rows = lines.length > 0 ? lines : ["商品卖点", "商品卖点", "商品卖点"];
  const [lineIndex, setLineIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    setLineIndex(startLine);
  }, [editing, startLine]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing, lineIndex]);

  return (
    <div ref={cardRef} data-selling-card="1" className="relative" style={{ fontSize: fontPx }}>
      <div className="flex flex-col gap-[0.42em]">
        {rows.map((line, index) => (
          <div key={index} data-selling-line={index} className="flex w-max items-center gap-[0.35em] text-[#1d1d1f]">
            <span className="inline-flex h-[1.05em] w-[1.05em] shrink-0 items-center justify-center">
              <SellingMarkIcon mark={mark} index={index} markColor={markColor} />
            </span>
            {editing && index === lineIndex ? (
              <input
                ref={inputRef}
                data-text-edit="1"
                value={line}
                size={Math.max(Array.from(line).length, 1)}
                spellCheck={false}
                className="w-auto shrink-0 rounded-[0.15em] border-0 bg-[#3d7eff]/25 px-[0.08em] py-[0.04em] font-semibold leading-none text-[#1d1d1f] outline-none"
                style={{
                  fontSize: "1em",
                  fontFamily: "inherit",
                  fontWeight: "inherit",
                  boxSizing: "content-box",
                  width: `${Math.max(Array.from(line).length, 1)}em`,
                }}
                onChange={(event) => {
                  const next = rows.slice();
                  next[index] = event.target.value;
                  onChange?.(next.join("\n"));
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    if (keepRef.current) {
                      keepRef.current = false;
                      return;
                    }
                    if (!cardRef.current?.contains(document.activeElement)) onCommit?.(rows.join("\n"));
                  }, 0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") event.currentTarget.blur();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (index < rows.length - 1) {
                      keepRef.current = true;
                      setLineIndex(index + 1);
                    } else {
                      event.currentTarget.blur();
                    }
                  }
                }}
                onPointerDown={(event) => event.stopPropagation()}
              />
            ) : (
              <span
                className="font-semibold leading-none"
                onMouseDown={(event) => {
                  if (!editing) return;
                  event.preventDefault();
                  event.stopPropagation();
                  keepRef.current = true;
                  setLineIndex(index);
                }}
              >
                {line || "\u00a0"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SellingLine({
  mark,
  index,
  text,
  fontPx,
  color,
  fontFamily,
  fontWeight,
  editing,
  markW = 1.05,
  markH = 1.05,
  markColor,
  markActive,
  onChange,
  onCommit,
  onMarkPointerDown,
  onMarkResize,
}: {
  mark: ImageEditorSellingMark;
  index: number;
  text: string;
  fontPx: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: React.CSSProperties["fontWeight"];
  editing?: boolean;
  markW?: number;
  markH?: number;
  markColor?: string;
  markActive?: boolean;
  onChange?: (text: string) => void;
  onCommit?: (text: string) => void;
  onMarkPointerDown?: (event: React.PointerEvent<HTMLSpanElement>) => void;
  onMarkResize?: (handle: SellingMarkHandle, event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);
  const chars = Math.max(Array.from(text).length, 1);
  return (
    <div
      data-selling-line="0"
      className="flex w-max items-center gap-[0.35em]"
      style={{ fontSize: fontPx, fontFamily, fontWeight, color }}
    >
      <span
        data-text-mark="1"
        className="relative inline-flex shrink-0 items-center justify-center"
        style={{
          width: `${markW}em`,
          height: `${markH}em`,
          outline: markActive ? "2px solid rgba(61,126,255,0.9)" : undefined,
          outlineOffset: 2,
        }}
        onPointerDown={onMarkPointerDown}
      >
        <SellingMarkIcon mark={mark} index={index} markW={markW} markH={markH} markColor={markColor} />
        {markActive
          ? (Object.keys(MARK_HANDLE_POS) as SellingMarkHandle[]).map((id) => (
              <button
                key={id}
                type="button"
                data-text-handle="1"
                aria-label={`拉伸色块 ${id}`}
                style={{ touchAction: "none" }}
                className={`pointer-events-auto absolute z-30 box-border h-2 w-2 touch-none select-none rounded-[2px] border border-white bg-[#2a2420] shadow-[0_0_0_1px_rgba(42,36,32,0.35)] ${MARK_HANDLE_POS[id]}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onMarkResize?.(id, event);
                }}
              />
            ))
          : null}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          data-text-edit="1"
          value={text}
          size={chars}
          spellCheck={false}
          className="w-auto shrink-0 rounded-[0.15em] border-0 bg-[#3d7eff]/25 px-[0.08em] py-[0.04em] font-semibold leading-none outline-none"
          style={{
            fontSize: "1em",
            fontFamily: "inherit",
            fontWeight: "inherit",
            color: "inherit",
            boxSizing: "content-box",
            width: `${chars}em`,
          }}
          onChange={(event) => onChange?.(event.target.value)}
          onBlur={(event) => onCommit?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : (
        <span className="font-semibold leading-none">{text || "\u00a0"}</span>
      )}
    </div>
  );
}

function SellingMarkIcon({
  mark,
  index,
  markW = 1.05,
  markH = 1.05,
  markColor,
}: {
  mark: ImageEditorSellingMark;
  index: number;
  markW?: number;
  markH?: number;
  markColor?: string;
}) {
  const glyph = Math.min(markW, markH);
  const accent = markColor || (mark === "num" || mark === "star" ? "#f0a04a" : "#e5484d");
  if (mark === "num") {
    return (
      <span className="font-bold leading-none" style={{ fontSize: `${glyph * 0.62}em`, color: accent }}>
        0{index + 1}
      </span>
    );
  }
  if (mark === "dot") return <span className="h-[72%] w-[72%] rounded-full" style={{ background: accent }} />;
  if (mark === "star") {
    return (
      <span className="leading-none" style={{ fontSize: `${glyph * 0.85}em`, color: accent }}>
        ★
      </span>
    );
  }
  if (mark === "line") return <span className="h-[18%] w-[78%] rounded-full" style={{ background: accent }} />;
  return (
    <span
      className="grid h-full w-full place-items-center rounded-[0.22em] font-bold leading-none text-white"
      style={{ fontSize: `${glyph * 0.62}em`, background: accent }}
    >
      ✓
    </span>
  );
}

export function TextTemplateThumb({ item, wide }: { item: ImageEditorTextTemplate; wide?: boolean }) {
  if (item.poster) {
    return (
      <img
        src={item.poster}
        alt=""
        draggable={false}
        className={`h-full w-full object-contain ${wide ? "bg-white p-1" : "bg-[#f6f4ef] p-1"}`}
      />
    );
  }
  if (item.kind === "selling") {
    return (
      <div className={`flex h-full w-full items-center justify-center px-2 ${wide ? "bg-white" : "bg-[#f6f4ef] p-1"}`}>
        <SellingPointCard
          mark={item.mark ?? "checks"}
          markColor={item.markColor}
          text={"商品卖点\n商品卖点\n商品卖点"}
          fontPx={wide ? 9 : 7}
        />
      </div>
    );
  }
  if (item.kind === "stamp" || item.kind === "bubble" || item.kind === "burst" || item.kind === "frame" || item.kind === "coil" || item.kind === "ribbon") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#f6f4ef] p-1.5">
        <ShapeTextArt kind={item.kind} text={item.sample} color={item.color} bg={item.bg} fontPx={12} />
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#f6f4ef] px-1">
      {item.kind === "banner" || item.kind === "pill" ? (
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none" style={{ background: item.bg, color: item.color }}>
          {item.sample}
        </span>
      ) : item.kind === "gold" ? (
        <span className="bg-gradient-to-b from-[#fff6d0] to-[#f0b429] bg-clip-text text-[13px] font-black leading-none text-transparent">
          {item.sample}
        </span>
      ) : item.kind === "mark" ? (
        <span className="bg-[linear-gradient(transparent_58%,#f7c948_58%)] text-[11px] font-semibold leading-none text-[#1d1d1f]">
          {item.sample}
        </span>
      ) : item.kind === "body" ? (
        <span className="text-center text-[10px] leading-snug text-[#3a322c]">{item.sample}</span>
      ) : (
        <span className="text-[13px] font-black leading-none" style={{ color: item.color }}>
          {item.sample}
        </span>
      )}
    </div>
  );
}
