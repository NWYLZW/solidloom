# 领域包契约

领域包是通用平台与具体业务之间的边界。它只声明领域定义、模型、能力和界面扩展描述符，不依赖 React、Three.js 或数据库适配层。删除某个领域包后，平台共享类型仍应保持完整。

## Manifest

`DomainPackageManifest`、可序列化的 `domainPackageManifestSchema` 和运行时校验器由本目录同一组常量与类型生成。Manifest 必须包含：

- `id` 与独占的 `namespace`；领域定义 ID 必须使用 `<namespace>.<name>`。
- 代码版本 `version` 与持久化数据版本 `dataVersion`。
- SolidLoom 兼容范围 `platformVersion`。
- 带版本范围的 `dependencies`，以及显式的 `extends` 关系。
- 实体、组件、关系、资源、指标、动作、流程、规则和视图定义目录。
- 从旧数据版本迁移到当前版本的声明式 `migrations`。

支持的版本范围刻意保持保守：`*`、精确版本、比较符组合、`^` 和 `~`。不支持的表达式会在注册前报错，不能静默按近似规则处理。

```ts
const packageDefinition = defineDomainPackage({
  schemaVersion: 1,
  id: "example-domain",
  namespace: "example-domain",
  displayName: "示例领域",
  description: "用于说明领域包契约。",
  version: "1.2.0",
  dataVersion: "2.0.0",
  status: "planned",
  platformVersion: "^0.1.0",
  dependencies: [{ id: "foundation", version: "^1.0.0" }],
  extends: ["foundation"],
  definitions: {
    entityTypes: ["example-domain.employee"],
    componentTypes: [], relationTypes: [], resourceTypes: [], metricTypes: [],
    actionTypes: [], processTypes: [], ruleSets: [], viewDefinitions: [],
  },
  migrations: [{
    id: "example-domain.migration.v1-v2",
    from: "1.0.0",
    to: "2.0.0",
    entry: "./migrations/v1-v2.js",
    status: "planned",
  }],
}, { models: [], capabilities: [], uiExtensions: [] });
```

## 注册和冲突

`createDomainPackageRegistry` 在贡献进入应用前校验平台兼容性、依赖版本、扩展关系、依赖环、命名空间和定义 ID。模型、能力与界面扩展也通过各自的通用注册表检查重复 ID。

`planned` 领域包不能发布 `available` 贡献。尚未实现的迁移同样必须标为 `planned`，不能在界面或文档中表现为可执行。

## 数据升级

`planDomainPackageMigration` 只计算确定性的迁移路径，不执行任意代码。存储适配层在写入新版本数据前必须调用 `assertDomainPackageMigrationReady`：

- `current`：数据已经是当前版本。
- `ready`：全部迁移步骤均可用，可以由后续执行器逐步执行。
- `planned`：路径已声明，但至少一个步骤尚未实现。
- `unavailable`：没有迁移路径，或请求从新版本静默降级。

## 新增领域

1. 在本目录创建独立子目录，并以 `index.ts` 作为唯一装配入口。
2. 使用 `defineDomainPackage` 声明完整 manifest 与贡献项。
3. 内置领域加入 `builtInDomainPackages`；第三方加载器可直接调用 `createDomainPackageRegistry`。
4. 为 manifest、版本约束、冲突和迁移路径补充契约测试。
