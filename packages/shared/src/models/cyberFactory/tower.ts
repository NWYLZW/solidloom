import type {
  BoxFeature,
  CreateModelInput,
  ModelFeature,
  ModelVariable,
  RoomShellSource,
  Vector3Tuple,
} from "../../types.js";
import {
  box,
  cylinder,
  ellipsoid,
  group,
  model,
  offsetWithXRotation,
  origin,
  proceduralRoomShell,
  recessedLaptopDeck,
  recessedRoundedPanel,
  sphere,
  withAppearance,
  withFeatureAppearances,
  withParameterExpressions,
  type AppearanceDefinition,
} from "./factory.js";

export function createTower(): CreateModelInput {
  const chassis = withFeatureAppearances([
    box("cyber-tower-chassis", "机箱背板", [260, 504, 14], [0, 270, -228]),
    box("cyber-tower-bottom-frame", "底部框架", [260, 18, 470], [0, 9, 0]),
    box("cyber-tower-top-frame", "顶部框架", [260, 18, 470], [0, 531, 0]),
    box("cyber-tower-left-panel", "左侧板", [14, 504, 442], [-123, 270, 0]),
    box("cyber-tower-side-panel", "右侧玻璃面板", [8, 496, 438], [126, 270, 0]),
    box("cyber-tower-front-panel", "前置面板", [220, 470, 18], [0, 292, 244]),
  ], { material: "metal", color: "#354047" }, {
    "cyber-tower-side-panel": { material: "glass", color: "#5B8FA1" },
    "cyber-tower-front-panel": { material: "plastic", color: "#20282D" },
  });
  const rawCooling: ModelFeature[] = [-145, 0, 145].map((offset, index) => (
    cylinder(`cyber-tower-fan-${index + 1}`, `前置风扇 ${index + 1}`, 62, 12, [0, 292 + offset, 258], [90, 0, 0])
  ));
  rawCooling.push(
    cylinder("cyber-tower-rear-fan", "后置风扇", 54, 12, [0, 390, -241], [90, 0, 0]),
  );
  const cooling = withFeatureAppearances(rawCooling, { material: "plastic", color: "#34434B" });
  const controls = withFeatureAppearances([
    cylinder("cyber-tower-power", "电源按钮", 18, 14, [78, 510, 225], [90, 0, 0]),
  ], { material: "plastic", color: "#252E33" }, {
    "cyber-tower-power": { material: "plastic", color: "#C8E94B" },
  });
  const features = [...chassis, ...cooling, ...controls];
  return model("主机箱", "采用空心金属框架、右侧玻璃面板和三风扇散热的赛博工厂计算主机。", features, [
    group("cyber-tower-chassis-group", "机箱结构", chassis),
    group("cyber-tower-cooling", "散热系统", cooling),
    group("cyber-tower-controls", "控制组件", controls),
  ]);
}
