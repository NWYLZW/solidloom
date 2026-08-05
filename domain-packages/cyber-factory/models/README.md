# 赛博工厂模型资产目录

每个模型使用独立目录，避免多人并行时共同编辑中央示例文件：

```text
models/
  <asset-id>/
    index.ts       # 只装配并导出本资产
    manifest.ts    # 可序列化的参数、材质、锚点、碰撞体与 LOD 元数据
    model.ts       # 参数化几何工厂
    preview.ts     # 可选的独立预览配置
    *.test.ts      # 本资产局部测试
```

## 约定

- `asset-id` 和资产内所有 ID 使用稳定的小写 kebab-case；发布后不因显示名称变化而修改。
- 几何工厂返回 `CreateModelInput`，manifest 通过 `ModelAssetDefinition` 与工厂绑定。
- 模型底面由 `placement.groundY` 声明；不要为了视觉对齐偷偷改变建模基准。
- 材质槽只引用本资产的特征 ID。交互锚点、碰撞体和关节绑定引用不存在的目标时校验失败。
- 桌面端和移动端分别声明预览与 LOD；没有降级需求也要给出明确配置。
- 新模型只修改自己的目录。公共契约或注册机制的变化应在对应架构 Issue 协调。
- 运行时接入不写在本目录的模型工厂中，由领域包注册器统一完成。

未接入运行时的模型能力必须保持 `planned`，不能因存在 manifest 就在界面中标记为可用。
