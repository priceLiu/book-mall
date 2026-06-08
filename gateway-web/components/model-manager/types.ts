export type ModelTab = "text" | "image" | "function";

export type CredentialRow = {
  id: string;
  alias: string;
  providerKind: string;
  apiKeyMasked: string;
  baseUrl: string | null;
  active: boolean;
  channel: string | null;
  sortOrder: number;
  isDefaultForProvider: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CatalogModel = {
  modelKey: string;
  displayName: string;
  requestKind: string;
  capabilities?: string[];
};

export type CatalogGroup = {
  providerKind: string;
  label: string;
  credentialBound: boolean;
  models: CatalogModel[];
};
