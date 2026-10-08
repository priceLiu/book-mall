# 统一资产库 · 选用契约

> 状态：已实施（Phase 1 · 客户端联邦）  
> 关联：[`docs/项目产资产.md`](../../../docs/项目产资产.md) · [`docs/全局资产库.md`](../../../docs/全局资产库.md)

## 1. 原则

- **保存**与**选用**分离：保存仍走「保存项目资产 / 保存平台资产库」；选用统一 **资产库** 弹层。
- **不合并存储表**：列表由各 app 的 `UnifiedAssetLibraryApiClient` 按 Tab fan-out 现有 API。

## 2. Tab（AssetLibrarySection）

| section | 含义 | 典型数据源 |
|---------|------|------------|
| `platform` | 平台官方 | catalog `platformOnly` |
| `shared` | 我的共用 | catalog user/team + `ai-space/assets` works |
| `project` | 本项目 | 见 §3 |

## 3. 本项目 · 按应用

| app | API | 备注 |
|-----|-----|------|
| `canvas` | `GET /api/canvas/project-assets?projectId=` | `insertMode: projectAssetInsert` |
| `ecom` | SSO `listAssets` · `module` | `insertMode: ecomAssetRef` 或 URL |
| `quick-replica` | `GET .../quick-replica/templates?scope=user` | 默认 pick URL |

## 4. UnifiedAssetPickItem

```ts
type AssetPickProvenance =
  | "catalog"
  | "works"
  | "projectAsset"
  | "ecomAsset"
  | "qrTemplate";

type AssetPickInsertMode =
  | "url"
  | "projectAssetInsert"
  | "ecomAssetRef"
  | "qrTemplateRef";

type UnifiedAssetPickItem = {
  id: string;
  title: string;
  ossUrl: string;
  thumbUrl?: string | null;
  section: AssetLibrarySection;
  provenance: AssetPickProvenance;
  insertMode: AssetPickInsertMode;
  displayType?: string;
  scope?: string;
  catalogKind?: string;
  projectAssetKind?: string;
  ecomModule?: string;
  promptOnly?: boolean;
  description?: string | null;
};
```

## 5. OpenAssetLibraryOptions

扩展 `OpenGlobalAssetLibraryOptions`：

- `app`: `"canvas" | "ecom" | "quick-replica"`
- `defaultSection?: AssetLibrarySection`
- `ecomModule?: string` · `ecomModules?: string[]`
- `projectId?: string`
- `allowedCatalogKinds?: GlobalAssetCatalogKind[]`
- `allowedProjectKinds?: string[]`
- `media?: "image" | "video" | "all"`

## 6. UI 真源

`e-commerce-toolkit/docker-shared/global-asset-library/unified-asset-library-dialog.tsx`  
同步：`scripts/sync-global-asset-library.mjs`
