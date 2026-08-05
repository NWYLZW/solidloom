# 领域包注册约定

领域包只负责声明自己贡献的模型、能力与界面扩展描述符，不直接依赖 React、Three.js 或数据库适配层。

新增领域时：

1. 在本目录创建独立子目录，并以 `index.ts` 作为唯一装配入口。
2. 使用 `defineDomainPackage` 声明 manifest 与贡献项。
3. 将领域包加入 `builtInDomainPackages`；第三方加载器可以直接调用 `createDomainPackageRegistry`，无需修改内置数组。
4. 未完成的模型、能力或界面扩展必须使用 `planned`，不能提前标记为 `available`。

注册时会统一校验领域包、模型、能力和界面扩展 ID。不同领域之间的重复 ID 会在应用启动前直接报错。
