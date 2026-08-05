# 仓储与内部物流资产套件

本目录独立交付 Epic #2 / Issue #52，只消费 #45 的 `ModelAssetDefinition` 契约，不修改公共 registry、schema、示例或共享入口。五项资产均保持 `planned`，等待统一注册与运行时接入。

## 独立资产

- `cyber-factory-warehouse-rack`：按跨数、层数、单跨宽度、高度和深度生成货架；跨数与层数没有人为设置的上限，仅受运行设备资源约束；每个货位具有稳定 socket、前侧取货锚点和后侧补货锚点。
- `cyber-factory-warehouse-pallet`：带顶部装载 socket 和前后货叉入口的木质托盘。
- `cyber-factory-warehouse-tote`：带真实开放内腔、内容 socket 和双侧搬运锚点的塑料周转箱。
- `cyber-factory-warehouse-cart`：带装载 socket、推行锚点、双层台面、四角承重支架和接地四轮的物流推车。
- `cyber-factory-warehouse-stacker-crane`：默认采用覆盖三跨货架的 3.8 米轨道、2.6 米紧凑单立柱和 1 米货叉行程，载货台以 1.16 × 0.9 米为标准托盘保留净空；输入稳定格口 ID 后可生成确定性的取货或上货计划。

所有模型使用毫米、`+y` 向上、`+z` 朝正面，底面基准为 `y = 0`。资产可独立引用，也可在预览中组合成仓储场景；组合预览会根据货架深度与载货台深度自动把拣选面贴到行走底座边缘。预览提供“场景总览”和五项独立资产标签页；进入单项资产后，可使用参数控件实时重建模型并恢复默认值。货架使用立柱、横梁和每层货板的分体碰撞体，不用整块碰撞体封死货位；移动 LOD 省略斜撑、握边或次要承载层。

## 堆垛机取放计划

`planWarehouseRetrieval(slotId, rackParameters, craneParameters)` 接受形如 `warehouse-rack-slot-b03-l04` 的稳定格口 ID，校验货架范围、轨道横移行程和货叉伸出行程，然后生成预占、横移、升降、伸叉、挂接、收叉、下降、移动到左侧出库位和在载货台内释放九个确定性步骤。设备默认停在左侧出库端；货叉会先伸到托盘远端，挂接阶段抬升 20 毫米后再收回，避免半程带货与穿模。

`planWarehouseRestock(slotId, rackParameters, craneParameters)` 使用同一格口和行程校验，从左侧载货台挂接上货托盘，依次执行携货横移、升高、伸叉、下降放置、释放、空载收叉、下降和返回左侧十个步骤。预览中的“执行上货演示”会按该计划运行；`occupy-slot` 仍是本地 planned 动作，不代表公共库存运行时已经可用。

公共 `FeatureGraph` 当前没有直线关节，库存占用与 model-reference 挂接 API 也尚未交付，因此 manifest 不伪造可用 joints，动作计划中的预占、挂接和释放继续明确标记为 `planned`。本目录只负责稳定几何、运动分组、锚点和纯函数计划；正式运行时需要公共契约后续接入。

## 验证

```sh
npx tsc -p domain-packages/cyber-factory/models/warehouse/tsconfig.json
npx vitest run domain-packages/cyber-factory/models/warehouse/warehouse.test.ts
npx vite domain-packages/cyber-factory/models/warehouse --host 127.0.0.1 --port 4313
```

预览地址：

- 桌面：`http://127.0.0.1:4313/preview.html?quality=desktop`
- 移动：`http://127.0.0.1:4313/preview.html?quality=mobile`

视觉验收截图位于 `screenshots/desktop.png`、`screenshots/mobile.png`、`screenshots/stacker-desktop.png` 与 `screenshots/stacker-mobile.png`。
