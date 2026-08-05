# 参数化饮水机资产

本目录独立交付 Epic #2 / Issue #46 的饮水机模型，只消费 #45 提供的 `ModelAssetDefinition` 公共契约，不修改公共 registry、schema、示例或共享入口。资产尚未接入领域包注册器和运行时，因此相关能力仍为 `planned`。

## 坐标与参数

- 单位为毫米，`+y` 向上，`+z` 朝向机身正面。
- 模型原点位于机身底面中心，模型和机身碰撞体的最低点为 `y = 0`。
- `createWaterDispenserAssetDefinition()` 支持机身宽度、深度、高度、水桶半径/高度和出水口间距，并同步生成 manifest、碰撞体与锚点。
- feature graph 同时暴露 `--width` 等参数变量和表达式，可在编辑器中重新生成主要尺寸与位置。
- 稳定 ID 不随参数或 LOD 改变；桌面 LOD 保留接水盘格栅和饰条，移动 LOD 降低圆柱分段并省略次要细节。

## 交互与碰撞

- `water-fill-target` 是杯具接水目标，`water-fill-approach` 是角色站位与朝向。
- 热水、冷水按钮各有独立交互锚点。
- 机身使用盒碰撞体，水桶使用圆柱碰撞体；交互目标和角色站位位于机身正面，不与主碰撞体重叠。

## 验证

```sh
npx tsc -p domain-packages/cyber-factory/models/water-dispenser/tsconfig.json
npx vitest run domain-packages/cyber-factory/models/water-dispenser/water-dispenser.test.ts
npx vite domain-packages/cyber-factory/models/water-dispenser --host 127.0.0.1 --port 4312
```

预览地址：

- 桌面：`http://127.0.0.1:4312/preview.html?quality=desktop`
- 移动：`http://127.0.0.1:4312/preview.html?quality=mobile`

视觉验收截图在 `screenshots/desktop.png` 与 `screenshots/mobile.png`。
