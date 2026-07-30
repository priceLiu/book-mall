"use client";

import { useEffect, useRef } from "react";

type Props = {
  urls: string[];
  title?: string;
  /** 有新结果时滚动到可视区域 */
  scrollIntoView?: boolean;
};

export function ImageProcessingInlineResults({
  urls,
  title = "生成结果",
  scrollIntoView = true,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!scrollIntoView || urls.length === 0) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [urls, scrollIntoView]);

  if (urls.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6"
    >
      <h3 className="text-lg font-semibold text-[#1d1d1f]">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {urls.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-xl border border-[#e5e5ea]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="生成结果" className="h-auto w-full" />
          </a>
        ))}
      </div>
    </section>
  );
}
