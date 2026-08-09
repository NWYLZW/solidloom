# 现有办公资产正式化

本目录将共享包中已有的办公桌、人体工学椅、笔记本、显示器、主机箱和方块角色绑定到模型资产契约，不修改公共 registry、schema、`examples.ts` 或应用入口。

## 交付内容

- `manifest.ts`：六个资产的稳定 ID、参数、材质、Y=0 放置基准、碰撞体、座位/交互/动作锚点、关节绑定，以及桌面和手机 LOD。
- `performance.ts`：独立的 draw-call 与三角形预算；公共 schema 尚无 draw-call 字段，因此不在本任务伪造公共字段。
- `preview.html` / `preview.ts`：响应式独立预览，可逐资产切换桌面/手机层级、碰撞体、锚点和 1720 mm 角色比例尺。
- `office-existing.test.ts`：契约、真实尺寸、稳定 ID、Y=0、碰撞/锚点、关节和性能预算测试。

六个模块均保持 `planned`。独立预览说明几何与元数据可验收，不表示统一 registry、场景动作运行时或语义能力已经接入。

## 独立预览

在仓库根目录启动 Vite 后打开：

```text
/domain-packages/cyber-factory/models/office-existing/preview.html?asset=desk&device=desktop
```

`asset` 可取 `desk`、`chair`、`laptop`、`monitor`、`tower`、`avatar`；`device` 可取 `desktop` 或 `mobile`。每个组合都可通过固定 URL 独立复验。

默认尺度：桌面工作面 760 mm、座面 460 mm、方块角色 1720 mm。所有资产的本地支撑面均为 Y=0；笔记本、显示器和主机箱在场景中应通过 placement anchor 放到桌面或地面，不通过隐藏缩放或负 Y 偏移修正。
