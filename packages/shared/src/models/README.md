# 模型模块约定

模型通过 `ModelModule` 注册，不再集中写入 `examples.ts`。

- 程序化模型使用 `defineFactoryModelModule`，生成函数与辅助几何放在自己的目录。
- 符合模型资产契约的模型使用 `defineAssetModelModule`；注册前会校验 manifest、参数、材质、锚点、碰撞体、关节和 LOD 引用。
- `examples.ts` 只是旧调用方的兼容入口，不接受新的模型实现。

赛博工厂的现有示例按模型拆分在 `cyberFactory/` 中。新增模型只需增加自己的文件，并在对应领域包的模型模块列表中注册，不需要修改中央巨型示例文件。
