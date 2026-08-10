# 模块化厕所区域资产套件

本目录交付九个可独立引用的模型资产，不把厕所区域固化为不可拆分的单体场景：

- `cyber-factory-restroom-partition`：悬空隔断板、立柱和地脚。
- `cyber-factory-restroom-stall-door`：门框、向外开启门扇、门锁和旋转关节。
- `cyber-factory-restroom-toilet`：落地式坐便器、水箱、座圈和冲水按钮。
- `cyber-factory-restroom-urinal-bank`：1–6 个连续壁挂小便器与可选挡板。
- `cyber-factory-restroom-vanity`：1–3 个洗手盆的落地洗手台。
- `cyber-factory-restroom-mirror`：以局部 `Z=0` 墙面为安装基准的镜面。
- `cyber-factory-restroom-accessible-door`：带无障碍标识和动态门扇碰撞体的全高入口门。
- `cyber-factory-restroom-accessible-vanity`：无落地柜体、保留正面净空的壁挂洗手台。
- `cyber-factory-restroom-accessibility-support`：可按左右转移侧镜像的扶手与紧急呼叫组件。

## 组合与坐标

- 所有尺寸使用真实毫米，`Y` 为向上轴，`placement.groundY` 固定为 `0`。
- 隔断沿局部 `X` 方向延伸，可绕 `Y` 轴旋转 90° 形成隔间侧墙。
- 隔间门的局部 `Z+` 是隔间外侧；门扇向外开启，打开后保持门洞通行净宽。
- 小便器和镜面的局部 `Z=0` 是墙面安装平面，器具向 `Z+` 投影。
- 洗手台落地放置，背面管线锚点可与墙面服务面连接。

每个 `createRestroom*Definition(parameters)` 工厂使用同一组规范化参数生成几何、manifest、碰撞体和锚点，避免尺寸变化后空间元数据漂移。现有公共 `ModelAssetDefinition.createModel` 仍是无参函数，因此参数化通过 definition 工厂提供；正式运行时接入前所有模块状态保持 `planned`。

## 厕所类型组合

独立预览支持男厕、女厕和无障碍厕所组合切换。男厕场景使用两个坐便器隔间，并实例化可配置 1–6 个器具的小便器组合；女厕场景从资产清单中完全省略 `cyber-factory-restroom-urinal-bank`，并将整排空间连续重排为五个等宽坐便器隔间，末端隔断与洗手台侧墙收口，不保留无功能空槽。小便器模型本身仍只接受 1–6 个器具，不使用 `count: 0` 表示资产缺席。

无障碍厕所是独立封闭单间，不实例化普通隔间或小便器。预览提供“左侧转移”和“右侧转移”两种镜像布局：坐便器、壁挂洗手台、低位镜面、扶手、紧急呼叫点和入口门一起重排。壁挂洗手台不含落地柜体；扶手与呼叫组件通过稳定 feature、collider 和 anchor ID 保持左右布局可追踪。

该选择目前只验证 planned 资产的场景组合规则，不代表正式运行时已经提供厕所类型自动布局，也不声明符合特定地区的建筑法规认证。

## 小便器排列

`count`、`centerSpacing`、`urinalWidth`、`rimHeight`、`projection`、`dividerEnabled` 和 `dividerDepth` 可配置。中心距必须在相邻器具之间保留至少 240 mm 净距；挡板位于相邻中心的中点，并且比器具投影至少多 60 mm。

## 独立预览

```bash
npx vite domain-packages/cyber-factory/models/restroom --host 127.0.0.1 --port 4314
```

打开 `/preview.html`。预览组合多个独立 definition，仅用于桌面和手机视觉验收，不代表正式场景或语义运行时已经接入。界面可切换厕所类型、无障碍左右转移布局、小便器数量、中心距、挡板、门开合、锚点、碰撞体和桌面/手机 LOD。

## 验证

```bash
npm run build:packages
npx tsc -p domain-packages/cyber-factory/models/restroom/tsconfig.json
npx vitest run domain-packages/cyber-factory/models/restroom/restroom.test.ts
```
