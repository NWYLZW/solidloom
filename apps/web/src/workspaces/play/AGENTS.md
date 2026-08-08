# 运行视图界面规范

本文件适用于 `apps/web/src/workspaces/play` 及其子目录。仓库根目录的协作规范继续生效；发生冲突时，以更严格的规则为准。

## 产品边界

- 本目录承载玩家直接使用的运行视图、暂停菜单、设置和角色界面，不承载编辑器专用控件。
- 场景或领域模型只能提供菜单项、动作和文案等语义配置，不能向本目录注入任意内联样式或复制一套页面组件。
- 实体容器、设备等可复用交互放在 `apps/web/src/interaction-ui`；运行视图只负责选择展示方式和组合交互表面。

## 白板式默认外观

- 默认视觉保持中性、扁平、低装饰，作为开发者主题的“白板”。优先使用留白、分隔线、字号和字重表达层级。
- 可以学习成熟系统设置界面的设计原则：稳定的类别导航、清晰的内容标题、按主题分组的设置区、紧凑的设置行，以及控件与当前值就近呈现。学习信息架构和交互纪律，不一比一复制任何平台的材质、图标、尺寸、动效或品牌外观。
- 设置页优先采用“类别 → 分组 → 设置行 → 控件”的结构。简短枚举使用统一选择控件；布尔值使用开关；范围使用滑杆与数值；长枚举使用下拉框；只有需要视觉比较时才使用预览缩略图。
- 标签和说明位于设置行的信息侧，控件位于操作侧或紧随信息之后；同组控件对齐，不把每个选项扩张成独立的大卡片。
- 不使用毛玻璃、渐变、发光、纹理、重阴影或多层卡片作为默认效果；产品明确要求且能通过主题关闭时才可增加。
- 说明文字直接放在内容区，不为了填充空间套卡片。选项只有确实需要独立选择反馈时才获得背景或边框。
- 同一页面的相同交互必须使用同一个基础控件，不能同时出现自制分段按钮、卡片单选和普通按钮表达同一类单选行为。

## 标准控件与复用

- 优先复用本目录 `controls/` 中的基础控件。新增按钮、单选、开关、选择器或表单行前，先检查是否可扩展已有控件。
- 页面组件只负责数据、文案和组合，不重复实现原生输入隐藏、选中态、焦点态、禁用态和键盘行为。
- 基础控件保持领域无关，不包含“镜头”“皮肤”“售货机”等业务名称。第二处出现相同交互前必须抽取，明显属于通用形态时第一次就抽取。
- 优先使用原生 `button`、`input`、`select` 和 `fieldset` 保留键盘、表单与辅助技术语义，不用 `div` 模拟控件。

## CSS 定制契约

- 组件结构使用稳定的根类名、子元素类名、`data-*` 状态和 `aria-*` 状态；主题不得依赖脆弱的 DOM 层级或 `:nth-child`。
- 颜色、边框、背景、圆角、控件高度、间距和焦点环必须通过带回退值的 CSS 自定义属性读取。运行视图基础控件使用 `--play-*` 前缀。
- 组件不能在自身选择器中重定义公共定制变量，否则上层无法通过继承覆盖。应使用 `var(--play-xxx, var(--color-xxx))` 读取回退值。
- 不使用内联 `style` 传递纯视觉配置，不在 React 中根据主题拼颜色。主题通过运行视图根节点或组件根节点覆盖变量。
- CSS 文件与组件文件同目录维护；页面 CSS 只做布局，控件 CSS 负责控件本身的视觉和状态。
- 新增或修改公共变量时，在本文件的“公共变量”中补充，避免形成不可发现的隐式 API。

### 公共变量

标准选择控件支持以下变量，开发者可在 `.play-menu-screen`、页面根节点或控件根节点覆盖：

- `--play-accent-color`
- `--play-choice-border-color`
- `--play-choice-background`
- `--play-choice-hover-background`
- `--play-choice-selected-background`
- `--play-choice-accent-color`
- `--play-choice-text-color`
- `--play-choice-muted-color`
- `--play-choice-focus-color`
- `--play-choice-row-height`
- `--play-choice-radius`
- `--play-setting-row-height`
- `--play-setting-column-gap`
- `--play-setting-label-column`
- `--play-setting-control-column`
- `--play-setting-control-height`
- `--play-setting-text-color`
- `--play-setting-muted-color`
- `--play-settings-sidebar-width`
- `--play-settings-edge-inset`
- `--play-settings-border-color`
- `--play-settings-sidebar-background`
- `--play-settings-category-height`
- `--play-settings-category-hover-background`
- `--play-settings-category-selected-background`
- `--play-toggle-width`
- `--play-toggle-height`
- `--play-toggle-border-color`
- `--play-toggle-background`
- `--play-toggle-thumb-color`
- `--play-toggle-accent-color`
- `--play-toggle-focus-color`
- `--play-range-accent-color`
- `--play-range-focus-color`
- `--play-range-track-color`
- `--play-range-thumb-size`
- `--play-range-thumb-color`
- `--play-range-thumb-border-color`
- `--play-select-border-color`
- `--play-select-hover-border-color`
- `--play-select-background`
- `--play-select-text-color`
- `--play-select-focus-color`
- `--play-select-radius`

声音系统可以监听 `solidloom:play-audio-preferences-change` 事件，并从事件的 `detail` 读取 `muted` 和 `volume`。CSS 或 Canvas 声音实现也可读取 `--play-audio-volume`；不能要求领域包依赖运行视图内部组件。

## 运行时生命周期

- 必须区分结构配置与可热更新偏好。模型几何、碰撞拓扑和渲染管线属于结构配置；显隐、透明度、标签和用户展示偏好通常属于可热更新状态。
- 可热更新状态不得放入创建整个 Three.js runtime 的 effect 依赖中。为子 runtime 提供显式 setter，并由独立轻量 effect 同步。
- setter 必须请求必要的一帧渲染，但不能重建场景、模型、碰撞、交互状态或相机。
- 如果某项配置确实需要重建，代码旁必须说明依赖的资源或不变量，不能因为实现方便就沿用初始化闭包。

## 响应式与验证

- 同一套语义组件覆盖桌面和手机；通过 CSS 布局变化适配，不复制移动版组件树。
- 触控目标、键盘焦点、选中态和禁用态必须清晰，移动端需考虑安全区。
- 修改公共控件后至少检查菜单、设置和角色三个入口，并运行仓库规定的类型检查、测试与构建。
