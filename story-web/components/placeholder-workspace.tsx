import Link from "next/link";
import { Construction } from "lucide-react";

export function PlaceholderWorkspace({
  title,
  lead,
  nextHref,
  nextLabel,
}: {
  title: string;
  lead: string;
  nextHref: string;
  nextLabel: string;
}) {
  return (
    <div className="story-container py-16 sm:py-20">
      <div className="mx-auto max-w-2xl rounded-lg border border-white/10 bg-[var(--story-surface)] p-8 text-center sm:p-12">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Construction className="size-7 text-[var(--story-muted)]" />
        </div>
        <h1 className="story-serif text-2xl text-white">{title}</h1>
        <p className="twenty-body mt-3">{lead}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="twenty-btn-ghost">
            回到首页
          </Link>
          <Link href={nextHref} className="twenty-btn">
            {nextLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
