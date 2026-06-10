import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 「个人」Tab 与 /fees 根路径：统一进入积分用量（保留 from=account 等 query）。 */
export default function FeesIndexPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const v of value) qs.append(key, v);
      } else {
        qs.set(key, value);
      }
    }
  }
  const suffix = qs.toString();
  redirect(suffix ? `/fees/usage?${suffix}` : "/fees/usage");
}
