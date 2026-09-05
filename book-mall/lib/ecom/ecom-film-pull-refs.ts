import { randomUUID } from "crypto";

import type { FilmPullCharacterRef } from "@/lib/ecom/ecom-film-pull-types";

export const FILM_PULL_REF_MAX_PER_ROLE = 6;

export type FilmPullRefRole = "model" | "product";

const MODEL_PREFIX = "ref-film-pull-model-";
const PRODUCT_PREFIX = "ref-film-pull-product-";

export function isFilmPullModelRefId(id: string): boolean {
  return id.startsWith(MODEL_PREFIX);
}

export function isFilmPullProductRefId(id: string): boolean {
  return id.startsWith(PRODUCT_PREFIX);
}

export function listFilmPullModelRefs(refs: FilmPullCharacterRef[]): FilmPullCharacterRef[] {
  return refs.filter((r) => isFilmPullModelRefId(r.id) && r.ossUrl?.trim());
}

export function listFilmPullProductRefs(refs: FilmPullCharacterRef[]): FilmPullCharacterRef[] {
  return refs.filter((r) => isFilmPullProductRefId(r.id) && r.ossUrl?.trim());
}

export function createFilmPullRefId(role: FilmPullRefRole): string {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  return role === "model" ? `${MODEL_PREFIX}${suffix}` : `${PRODUCT_PREFIX}${suffix}`;
}

export function nextFilmPullRefLabel(
  role: FilmPullRefRole,
  refs: FilmPullCharacterRef[],
): string {
  const count =
    role === "model"
      ? listFilmPullModelRefs(refs).length
      : listFilmPullProductRefs(refs).length;
  return role === "model" ? `模特 ${count + 1}` : `产品 ${count + 1}`;
}

export function appendFilmPullReference(
  refs: FilmPullCharacterRef[],
  role: FilmPullRefRole,
  ossUrl: string,
): { refs: FilmPullCharacterRef[]; reference: FilmPullCharacterRef } {
  const existing =
    role === "model" ? listFilmPullModelRefs(refs) : listFilmPullProductRefs(refs);
  if (existing.length >= FILM_PULL_REF_MAX_PER_ROLE) {
    throw new Error(
      role === "model"
        ? `模特图最多 ${FILM_PULL_REF_MAX_PER_ROLE} 张`
        : `产品图最多 ${FILM_PULL_REF_MAX_PER_ROLE} 张`,
    );
  }

  const reference: FilmPullCharacterRef = {
    id: createFilmPullRefId(role),
    ossUrl,
    label: nextFilmPullRefLabel(role, refs),
  };

  return { refs: [...refs, reference], reference };
}

export function removeFilmPullReference(
  refs: FilmPullCharacterRef[],
  refId: string,
): FilmPullCharacterRef[] {
  const target = refs.find((r) => r.id === refId);
  if (!target) throw new Error("参考图不存在");
  if (!isFilmPullModelRefId(refId) && !isFilmPullProductRefId(refId)) {
    throw new Error("无效的参考图 ID");
  }
  return refs.filter((r) => r.id !== refId);
}

export function buildFilmPullMentionCatalog(refs: FilmPullCharacterRef[]): Array<{
  ref: FilmPullCharacterRef;
  token: string;
  index: number;
  role: FilmPullRefRole;
}> {
  const entries: Array<{
    ref: FilmPullCharacterRef;
    token: string;
    index: number;
    role: FilmPullRefRole;
  }> = [];
  let index = 1;
  for (const ref of listFilmPullModelRefs(refs)) {
    entries.push({ ref, token: `@图片${index}`, index, role: "model" });
    index += 1;
  }
  for (const ref of listFilmPullProductRefs(refs)) {
    entries.push({ ref, token: `@图片${index}`, index, role: "product" });
    index += 1;
  }
  return entries;
}
