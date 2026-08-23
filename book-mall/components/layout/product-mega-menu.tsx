import Image from "next/image";
import { buildBookPortalNavItems, BOOK_PORTAL_EXTERNAL_LINK_PROPS } from "@/lib/portal-nav";

/** 顶栏「产品」下拉：与各子站 federated 门户菜单一致 */
export function ProductMegaMenuContent() {
  const items = buildBookPortalNavItems();

  return (
    <div className="flex gap-6 p-4">
      <Image
        src="/logo2.png"
        alt="智选AI"
        className="h-44 w-44 shrink-0 rounded-md object-contain bg-transparent dark:mix-blend-screen"
        width={400}
        height={400}
      />
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
        {items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}
            className="flex min-h-[72px] flex-col justify-center rounded-md border border-transparent p-3 hover:border-secondary hover:bg-muted"
          >
            <p className="font-semibold leading-none text-foreground">{item.label}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
