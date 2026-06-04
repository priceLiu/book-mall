const ECOM_PREFIX = "ecom-toolkit__";

export function isEcomToolkitToolKey(toolKey: string): boolean {
  const t = toolKey.trim();
  return t === "ecom-toolkit" || t.startsWith(ECOM_PREFIX);
}

export function ecomClientPage(
  userId: string,
  workspaceId: string,
  toolKey: string,
): string {
  return `ecom/${userId}/${workspaceId}/${toolKey}`;
}
