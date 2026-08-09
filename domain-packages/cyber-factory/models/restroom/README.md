# 模块化厕所区域资产套件

本目录交付六个可独立引用的模型资产，不把厕所区域固化为不可拆分的单体场景：

- `cyber-factory-restroom-partition`：悬空隔断板、立柱和地脚。
- `cyber-factory-restroom-stall-door`：门框、向外开启门扇、门锁和旋转关节。
- `cyber-factory-restroom-toilet`：落地式坐便器、水箱、座圈和冲水按钮。
- `cyber-factory-restroom-urinal-bank`：1–6 个连续壁挂小便器与可选挡板。
- `cyber-factory-restroom-vanity`：1–3 个洗手盆的落地洗手台。
- `cyber-factory-restroom-mirror`：以局部 `Z=0` 墙面为安装基准的镜面。

## 组合与坐标

- 所有尺寸使用真实毫米，`Y` 为向上轴，`placement.groundY` 固定为 `0`。
- 隔断沿局部 `X` 方向延伸，可绕 `Y` 轴旋转 90° 形成隔间侧墙。
- 隔间门的局部 `Z+` 是隔间外侧；门扇向外开启，打开后保持门洞通行净宽。
- 小便器和镜面的局部 `Z=0` 是墙面安装平面，器具向 `Z+` 投影。
- 洗手台落地放置，背面管线锚点可与墙面服务面连接。

每个 `createRestroom*Definition(parameters)` 工厂使用同一组规范化参数生成几何、manifest、碰撞体和锚点，避免尺寸变化后空间元数据漂移。现有公共 `ModelAssetDefinition.createModel` 仍是无参函数，因此参数化通过 definition 工厂提供；正式运行时接入前所有模块状态保持 `planned`。

## 小便器排列

`count`、`centerSpacing`、`urinalWidth`、`rimHeight`、`projection`、`dividerEnabled` 和 `dividerDepth` 可配置。中心距必须在相邻器具之间保留至少 240 mm 净距；挡板位于相邻中心的中点，并且比器具投影至少多 60 mm。

## 独立预览

```bash
npx vite domain-packages/cyber-factory/models/restroom --host 127.0.0.1 --port 4314
```

打开 `/preview.html`。预览组合多个独立 definition，仅用于桌面和手机视觉验收，不代表正式场景或语义运行时已经接入。界面可切换小便器数量、中心距、挡板、门开合、锚点、碰撞体和桌面/手机 LOD。

## 验证

```bash
npm run build:packages
npx tsc -p domain-packages/cyber-factory/models/restroom/tsconfig.json
npx vitest run domain-packages/cyber-factory/models/restroom/restroom.test.ts
```
