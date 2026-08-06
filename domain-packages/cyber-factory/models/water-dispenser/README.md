# 参数化饮水机资产

本目录提供参数化饮水机的领域预览、manifest 与验证；几何工厂由 `@solidloom/shared` 统一维护，并已注册到 SolidLoom 模型目录和交互试验场。

## 坐标与参数

- 单位为毫米，`+y` 向上，`+z` 朝向机身正面。
- 模型原点位于机身底面中心，模型最低点为 `y = 0`。
- `createWaterDispenserAssetDefinition()` 支持机身宽度、深度、高度、水桶半径/高度和出水口间距，并同步生成 manifest、碰撞体与锚点。
- 水桶直立收纳在机身下半部的中空储水柜中，桶口朝上连接抽水泵；上部机身不再放置外露水桶。
- 储水柜由侧壁、背板、底板与顶板围成真实内腔；无把手柜门属于独立关节组，提供关闭与打开两个稳定姿态。
- 接水区由前框与后壳围出真实凹槽，接水盘和三个出水口均位于机身正面以内。
- 顶部控制区依次提供热水、常温水、冷水按钮，并用独立状态灯展示通电、制热和制冷状态。
- feature graph 同时暴露 `--width` 等参数变量和表达式，可在编辑器中重新生成主要尺寸与位置。
- 稳定 ID 不随参数或 LOD 改变；桌面 LOD 保留接水盘格栅和饰条，移动 LOD 降低圆柱分段并省略次要细节。

## 交互与碰撞

- `water-fill-target` 是杯具接水目标，`water-fill-approach` 是角色站位与朝向。
- 热水、常温水、冷水按钮各有独立交互锚点。
- `cabinet-door-open-control` 标记无把手柜门的按压开启区域，`tank-storage-socket` 标记水桶收纳位。
- 上部后壳与接水区四周框架分别使用碰撞体，接水凹槽不被整块碰撞体封住；柜体侧壁/背板、动态柜门和水桶也有独立碰撞体。

预览中的“已通电 / 制热中 / 制冷中”是用于视觉验收的默认展示状态；SolidLoom 交互试验场当前接入了下柜门开合，出水与温控操作仍应以 `planned` 标记。

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
