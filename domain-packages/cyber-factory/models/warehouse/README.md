# 仓储与内部物流资产套件

本目录独立交付 Epic #2 / Issue #52，并通过 `scripts/seed-cyber-factory.mjs` 的目录约定自动注册。货架、托盘、周转箱、推车和堆垛机均可在工作台中使用。交互试验场还提供首个本地可运行闭环：货架展示固定货位货物，操作员在中央设备面板选择货位后，堆垛机按分段程序完成横移、升降、伸叉、托起、回程和出库，最后由操作员领取货物。

## 独立资产

- `cyber-factory-warehouse-rack`：按跨数、层数、单跨宽度、高度和深度生成货架；跨数与层数没有人为设置的上限，仅受运行设备资源约束；每个货位具有稳定 socket、前侧取货锚点和后侧补货锚点。`stackerCrane` 是货架的组合选项，开启后由货架统一派生轨道长度、设备朝向、取货面、控制锚点和所有货位运动坐标。
- `cyber-factory-warehouse-pallet`：带顶部装载 socket 和前后货叉入口的木质托盘。
- `cyber-factory-warehouse-tote`：带真实开放内腔、内容 socket 和双侧搬运锚点的塑料周转箱。
- `cyber-factory-warehouse-cart`：带装载 socket、推行锚点、单层台面和四个接地脚轮的物流推车；四根轮架直接连接脚轮与承载台。
- `cyber-factory-warehouse-stacker-crane`：仅保留为内部生成器和兼容预览，状态为 `planned`，不会注册为业务侧独立资产。业务场景只引用货架，并通过“绑定堆垛机”选项生成轨道、立柱、载货台与货叉。默认采用覆盖三跨货架的 3.8 米轨道、2.6 米紧凑单立柱和 1 米货叉行程，载货台以 1.16 × 0.9 米为标准托盘保留净空。

所有模型使用毫米、`+y` 向上、`+z` 朝正面，底面基准为 `y = 0`。组合货架只作为一个模型引用进入场景，堆垛机几何、碰撞体、运行锚点和货位元数据都随货架参数共同生成；因此改变货架宽度、跨数、层数、深度或高度时，不需要场景重新拼凑相对位置。预览提供“场景总览”和五项独立资产标签页；进入单项资产后，可使用参数控件实时重建模型并恢复默认值。货架使用立柱、横梁和每层货板的分体碰撞体，不用整块碰撞体封死货位；移动 LOD 省略斜撑、握边或次要承载层。

## 堆垛机取放计划

`planWarehouseRetrieval(slotId, rackParameters, craneParameters)` 接受形如 `warehouse-rack-slot-b03-l04` 的稳定格口 ID，校验货架范围、轨道横移行程和货叉伸出行程，然后生成预占、横移、升降、伸叉、挂接、收叉、下降、移动到左侧出库位和在载货台内释放九个确定性步骤。设备默认停在左侧出库端；货叉会先伸到托盘远端，挂接阶段抬升 20 毫米后再收回，避免半程带货与穿模。

`planWarehouseRestock(slotId, rackParameters, craneParameters)` 使用同一格口和行程校验，从左侧载货台挂接上货托盘，依次执行携货横移、升高、伸叉、下降放置、释放、空载收叉、下降和返回左侧十个步骤。预览中的“执行上货演示”会按该计划运行；`occupy-slot` 仍是本地 planned 动作，不代表持久化库存运行时已经可用。

公共 `FeatureGraph` 当前没有直线关节，因此 manifest 不伪造 joints。交互试验场改用模型引用上的通用分段动作程序驱动既有特征组和货物引用；领取状态会保存在当前本地运行视图中。跨进程持久化的货位预占、任务恢复、实体所有权原子提交与审计事件仍标记为 `planned`。

## 正式系统接入要求

堆垛机进入 `/play/{runId}` 后已具备本地视觉取货与领取闭环。面向持久化运营系统的正式能力还需要满足：

- 货架、货位、托盘、周转箱和堆垛机由场景引用，保持真实毫米比例和 `y = 0` 地面基准。
- 货位 ID、出库位和补货位可被动作系统查询，并在任务期间进行预占。
- 取货或上货的视觉步骤由动作进度驱动；取消、失败和暂停必须恢复到可解释状态。
- 在提交步骤原子更新实体所有权、容器归属、货位占用和模型引用挂接，并写入审计事件。
- 普通操作员只看到取货、上货和任务状态；维护、调试和手动复位按凭证或角色权限裁剪。
- 桌面端使用中央任务面板和键盘关闭入口，移动端提供等价触摸操作；独立预览截图不能代替系统内交互验收。

`cyber-factory-warehouse-stacker-crane` 不作为独立可用资产注册；其几何与运动部件由货架绑定选项复用。上述跨进程库存事务仍不得被描述为已完成。

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
