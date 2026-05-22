const ITEMS = [
  { strong: "同一剧场", soft: "same story" },
  { strong: "同一空间", soft: "same output" },
  { strong: "同一模板", soft: "same stage" },
] as const;

export function TwentyMarquee() {
  const row = (
    <>
      {ITEMS.map(({ strong, soft }) => (
        <span key={strong} className="mx-8 inline-flex items-baseline gap-3 whitespace-nowrap">
          <span className="story-serif text-4xl text-white sm:text-5xl md:text-6xl">{strong}</span>
          <span className="story-sans text-lg text-[var(--story-accent-soft)] sm:text-xl">{soft}</span>
        </span>
      ))}
    </>
  );

  return (
    <section className="overflow-hidden border-y border-white/10 py-10 sm:py-14">
      <div className="twenty-marquee-track flex w-max">
        {row}
        {row}
        {row}
        {row}
      </div>
    </section>
  );
}
