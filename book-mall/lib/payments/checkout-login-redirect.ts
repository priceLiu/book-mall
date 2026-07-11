/** 结账页 → 登录页：callbackUrl 须整体 encode，避免 planId/seats 被拆成登录页 query。 */
export function buildLoginRedirectForCheckout(pathWithSearch: string): string {
  const path = pathWithSearch.startsWith("/") ? pathWithSearch : `/${pathWithSearch}`;
  return `/login?callbackUrl=${encodeURIComponent(path)}`;
}

export function buildMembershipCheckoutPath(input: {
  planId?: string | null;
  seats?: string | number | null;
}): string {
  const q = new URLSearchParams();
  const planId = input.planId?.toString().trim();
  if (planId) q.set("planId", planId);
  const seats = input.seats?.toString().trim();
  if (seats) q.set("seats", seats);
  const search = q.toString();
  return `/checkout/membership${search ? `?${search}` : ""}`;
}
