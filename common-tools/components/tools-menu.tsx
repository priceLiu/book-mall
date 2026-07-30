import Link from "next/link";
import {
  Image,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import {
  LIVE_TOOLS,
  TOOL_CATEGORIES,
  type ToolRegistryEntry,
} from "@/lib/tools-registry";

const ICONS: Partial<Record<ToolRegistryEntry["slug"], LucideIcon>> = {
  "ai-retouch": Wand2,
  "ai-meme-generator": Sparkles,
  "ai-image-generator": Image,
};

function ToolCard({ tool }: { tool: ToolRegistryEntry }) {
  const Icon = ICONS[tool.slug] ?? Wand2;
  return (
    <Link
      href={`/t/${tool.slug}`}
      className="group flex flex-col rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-sm transition hover:border-[#0071e3] hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f6ff] text-[#0071e3]">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-[#1d1d1f] group-hover:text-[#0071e3]">
        {tool.label}
      </h2>
      <p className="mt-2 line-clamp-2 text-sm text-[#6e6e73]">{tool.description}</p>
    </Link>
  );
}

export function ToolsMenu() {
  return (
    <div className="space-y-10">
      {TOOL_CATEGORIES.map((cat) => {
        const items = LIVE_TOOLS.filter((t) => t.category === cat.id);
        if (items.length === 0) return null;
        return (
          <section key={cat.id}>
            <h2 className="text-lg font-semibold text-[#1d1d1f]">{cat.label}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
