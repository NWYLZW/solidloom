# 交互界面扩展

交互对象只提供状态和动作，不决定最终使用弹窗、侧栏或移动端抽屉。扩展点分为四层：

- `controller`：无头状态与经过运行时校验的动作。
- `renderers`：完整替换一种交互的 React 界面。
- `slots`：只替换物品、空槽等局部内容。
- `presentations` 与 `theme`：选择快速操作条、侧面板、居中弹窗或移动端抽屉，并覆盖设计 Token。

配置按照以下优先级逐层覆盖：

1. 当前 `Viewport3D` 实例的 `interactionUI`
2. 最近一层 `InteractionUIProvider`
3. 外层工作空间的 `InteractionUIProvider`
4. SolidLoom 内置默认值

## 快速换主题

```ts
import { createInteractionUI } from "../Viewport3D";

export const sceneInteractionUI = createInteractionUI({
  presentations: { container: "modal" },
  theme: {
    id: "my-scene",
    className: "my-scene-interactions",
    tokens: {
      "--interaction-color-accent": "#5c7cfa",
      "--interaction-dialog-radius": "18px",
      "--interaction-surface-width": "520px",
    },
  },
});
```

将配置传给 `Viewport3D` 的 `interactionUI` 属性即可。上层还可以使用 `InteractionUIProvider`，为整个工作空间或场景提供默认配置。

呈现模式可以由每个游戏或场景自行选择：

- `quick`：图标优先的紧凑操作条，适合高频动作。
- `panel`：不阻断场景的侧面板，适合浏览与连续操作。
- `modal`：带背景遮罩的居中界面，适合专注管理。
- `sheet`：窄屏底部抽屉。
- `auto`：桌面端使用 `panel`，窄屏使用 `sheet`。
- `anchored`：兼容旧配置，等同于 `panel`。

游戏运行页可通过 `?interaction-ui=quick|panel|modal|sheet|auto` 进行界面验收；正式游戏应通过 `createInteractionUI` 配置，而不是向玩家暴露这个预览参数。

默认渲染器公开以下稳定 Token：

```css
.my-scene-interactions {
  --interaction-color-accent: #5c7cfa;
  --interaction-color-accent-contrast: #fff;
  --interaction-dialog-backdrop: rgb(8 12 20 / 55%);
  --interaction-dialog-backdrop-filter: blur(8px);
  --interaction-dialog-radius: 18px;
  --interaction-dialog-shadow: 0 28px 80px rgb(0 0 0 / 32%);
  --interaction-surface-width: 560px;
}
```

主题类只负责视觉，不应查询库存、修改实体或绕过 controller。

## 替换局部组件

通过 `slots.container.Item` 和 `slots.container.EmptySlot` 替换物品或空槽，不需要复制完整弹窗。

```ts
const config = createInteractionUI({
  slots: {
    container: {
      Item: CustomItem,
      EmptySlot: CustomEmptySlot,
    },
  },
});
```

## 完整替换

复杂领域界面可以注册完整 React 渲染器：

```ts
const config = createInteractionUI({
  renderers: {
    container: CustomContainerRenderer,
  },
});
```

渲染器接收无头 `controller`、当前 `presentation` 和已经解析好的 `slots`。它只能通过 controller 发起业务动作，因此更换 UI 不会绕过运行时校验。

## 响应式呈现

`auto` 在桌面端解析为侧面板，在窄屏解析为底部抽屉。同一套 controller 和 slots 不需要为手机端复制业务实现。需要完全不同的移动端结构时，领域包可以注册自己的 renderer，并在 renderer 内根据容器宽度决定布局。
