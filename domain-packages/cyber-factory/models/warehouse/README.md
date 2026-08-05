# 仓储与内部物流资产套件

本目录独立交付 Epic #2 / Issue #52，只消费 #45 的 `ModelAssetDefinition` 契约，不修改公共 registry、schema、示例或共享入口。四项资产均保持 `planned`，等待统一注册与运行时接入。

## 独立资产

- `cyber-factory-warehouse-rack`：按跨数、层数、单跨宽度、高度和深度生成货架；跨数与层数没有人为设置的上限，仅受运行设备资源约束；每个货位具有稳定 socket、前侧取货锚点和后侧补货锚点。
- `cyber-factory-warehouse-pallet`：带顶部装载 socket 和前后货叉入口的木质托盘。
- `cyber-factory-warehouse-tote`：带真实开放内腔、内容 socket 和双侧搬运锚点的塑料周转箱。
- `cyber-factory-warehouse-cart`：带装载 socket、推行锚点、双层台面和四轮的物流推车。

所有模型使用毫米、`+y` 向上、`+z` 朝正面，底面基准为 `y = 0`。资产可独立引用，也可在预览中组合成仓储场景。预览提供“场景总览”和四项独立资产标签页；进入单项资产后，可使用参数滑杆实时重建模型并恢复默认值。货架使用立柱、横梁和每层货板的分体碰撞体，不用整块碰撞体封死货位；移动 LOD 省略斜撑、握边或次要承载层。

## 验证

```sh
npx tsc -p domain-packages/cyber-factory/models/warehouse/tsconfig.json
npx vitest run domain-packages/cyber-factory/models/warehouse/warehouse.test.ts
npx vite domain-packages/cyber-factory/models/warehouse --host 127.0.0.1 --port 4313
```

预览地址：

- 桌面：`http://127.0.0.1:4313/preview.html?quality=desktop`
- 移动：`http://127.0.0.1:4313/preview.html?quality=mobile`

视觉验收截图位于 `screenshots/desktop.png` 与 `screenshots/mobile.png`。
