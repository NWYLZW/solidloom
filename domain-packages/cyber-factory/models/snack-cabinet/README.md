# 参数化零食售货机资产包

这是赛博工厂领域包中的参数化零食售货机模型。模型已通过共享生成器接入内置领域包注册表，可由本地种子脚本创建并在工作台项目树中打开。

## 已包含

- 宽度、高度、深度，以及柜体、边框、强调色、层架、展示玻璃、屏幕与挡板六组模型级颜色参数；工作台修改模型变量后会通过共享生成器重新计算完整特征图。
- 颜色既可用取色器选择，也可输入十六进制值；后续修改尺寸时会保留模型级配色，单个零件的手工外观覆盖仍然优先。
- 金属柜体、四层陈列架，以及尺寸固定、可单独选择的商品槽位。
- 外部可通过 `inventory` 传入每层商品清单、颜色、材质和尺寸；`exact` 精确摆放，`repeat` 按柜体容量循环补满。
- 柜体宽度只改变可容纳的商品数量，不缩放单件商品。
- 固定整面玻璃展示窗、内部货道、取物内腔、支付屏和后侧补货门。
- 正面接近、选择、取物、库存挂接与后侧补货语义锚点。
- 取物挡板旋转关节与柜体、玻璃窗碰撞体。
- 桌面和手机两套 LOD 与独立响应式预览。

## 本地预览

启动仓库开发服务后打开：

`/domain-packages/cyber-factory/models/snack-cabinet/preview.html`

预览页可实时调整尺寸和配色、切换桌面或手机层级，并打开取物挡板验证出货交互。

## 工作台验证

执行 `npm run seed:cyber-factory` 后，项目树会显示“参数化零食售货机”。注册验证截图位于 `screenshots/workbench.png`，四层独立商品的实际工作台截图位于 `screenshots/workbench-inventory.png`。工作台收窄与扩宽后的参数重建结果分别位于 `screenshots/workbench-parameters-compact.png` 和 `screenshots/workbench-parameters-expanded.png`，取物挡板展开到 55° 的动作结果位于 `screenshots/workbench-action-expanded.png`，模型级改色并再次修改尺寸后的结果位于 `screenshots/workbench-model-colors.png`。

库存服务和运营规则绑定仍由后续领域任务负责；当前 `available` 表示模型资产、外部库存布局、参数、锚点、碰撞体、关节与工作台编辑能力已经可用。
