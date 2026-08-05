# 参数化咖啡机资产

该目录独立交付赛博工厂茶水区咖啡机，不修改公共模型注册表或共享协议。资产模块保持 `planned`，等待领域包注册流程统一接入。

## 交付内容

- `model.ts`：可调整宽度、高度、深度与石墨黑、瓷白、钴蓝三种配色的硬朗工业几何工厂；外壳仅保留 2–8 mm 小倒角。
- `manifest.ts`：稳定 ID、材质槽、地面基准、机身/托盘碰撞体、制作/取杯/杯位/补水锚点、水箱翻盖关节，以及桌面和移动 LOD。
- `preview.html` / `preview.ts`：不依赖公共 registry 的独立交互预览，可调整参数和开合水箱翻盖。
- `coffee-machine.test.ts`：契约、参数边界、稳定 ID、锚点和移动 LOD 测试。
- `tsconfig.json`：独立覆盖资产工厂、测试和预览代码的严格类型检查。

## 独立预览

从仓库根目录运行：

```bash
npx vite --host 127.0.0.1
```

打开 `/domain-packages/cyber-factory/models/coffee-machine/preview.html`。窄屏会自动切换至移动 LOD，可通过右上角设备选择器显式切换。

局部验证：

```bash
npx tsc -p domain-packages/cyber-factory/models/coffee-machine/tsconfig.json
npx vitest run domain-packages/cyber-factory/models/coffee-machine/coffee-machine.test.ts
```

## 验收截图

桌面端 1280 × 720：

![咖啡机桌面端独立预览](screenshots/desktop.jpg)

手机端 390 × 844：

![咖啡机手机端简化预览](screenshots/mobile.jpg)

## 坐标约定

- 单位：`mm`
- 上轴：`y`
- 机身正面：`+z`
- 地面基准：`y = 0`
- 制作和取杯锚点位于机身正面外侧；杯位锚点位于出液口下方的托盘上。
