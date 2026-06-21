"use client";

const MASONRY_ASPECTS = ["aspect-[4/3]", "aspect-[3/4]", "aspect-video", "aspect-[4/3]", "aspect-[3/4]"];

export function QrKindBrowseSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="qr-card overflow-hidden">
          <div className="qr-skeleton aspect-[4/3] w-full rounded-none" />
          <div className="px-2 py-2">
            <div className="qr-skeleton h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function QrMasonryGallerySkeleton({ columnCount }: { columnCount: number }) {
  const cols = Array.from({ length: columnCount }, (_, colIndex) =>
    Array.from({ length: 3 }, (_, rowIndex) => {
      const aspect = MASONRY_ASPECTS[(colIndex + rowIndex) % MASONRY_ASPECTS.length];
      return (
        <div key={`${colIndex}-${rowIndex}`} className="mb-3 rounded-[16px] p-[6px]">
          <div className={`qr-skeleton w-full rounded-[10px] ${aspect}`} />
          <div className="px-2 py-[6px]">
            <div className="qr-skeleton h-4 w-2/3" />
          </div>
        </div>
      );
    }),
  );

  return (
    <div className="flex gap-3" aria-hidden>
      {cols.map((col, colIndex) => (
        <div key={colIndex} className="flex min-w-0 flex-1 flex-col">
          {col}
        </div>
      ))}
    </div>
  );
}

export function QrGridGallerySkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 p-2 md:grid-cols-3 xl:grid-cols-4"
      aria-hidden
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="qr-card overflow-hidden">
          <div className="qr-skeleton aspect-[4/3] w-full rounded-none" />
          <div className="px-2 py-2">
            <div className="qr-skeleton h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
