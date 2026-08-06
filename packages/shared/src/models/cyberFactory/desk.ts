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

export function createDesk(): CreateModelInput {
  const surface = withFeatureAppearances([
    box("cyber-desk-top", "桌面", [1600, 34, 760], [0, 743, 0]),
    cylinder("cyber-desk-grommet-left", "左穿线孔", 34, 10, [-520, 765, 255]),
    cylinder("cyber-desk-grommet-right", "右穿线孔", 34, 10, [520, 765, 255]),
  ], { material: "wood", color: "#76513B" }, {
    "cyber-desk-grommet-left": { material: "metal", color: "#273137" },
    "cyber-desk-grommet-right": { material: "metal", color: "#273137" },
  });
  const frame = withFeatureAppearances([
    box("cyber-desk-leg-fl", "左前桌腿", [54, 720, 54], [-710, 360, -300]),
    box("cyber-desk-leg-fr", "右前桌腿", [54, 720, 54], [710, 360, -300]),
    box("cyber-desk-leg-bl", "左后桌腿", [54, 720, 54], [-710, 360, 300]),
    box("cyber-desk-leg-br", "右后桌腿", [54, 720, 54], [710, 360, 300]),
    box("cyber-desk-crossbar", "后横梁", [1420, 70, 42], [0, 590, 300]),
    box("cyber-desk-modesty", "挡板", [1120, 300, 20], [0, 445, 315]),
  ], { material: "metal", color: "#4B5960" }, {
    "cyber-desk-modesty": { material: "metal", color: "#5C686E" },
  });
  const accessories = withFeatureAppearances([
    box("cyber-desk-cable-tray", "线缆托盘", [1080, 70, 120], [0, 635, 240]),
    box("cyber-desk-control-rail", "控制导轨", [360, 42, 54], [420, 705, -350]),
    cylinder("cyber-desk-height-button", "升降按钮", 18, 22, [540, 704, -386], [90, 0, 0]),
  ], { material: "metal", color: "#38464D" }, {
    "cyber-desk-height-button": { material: "plastic", color: "#B7D83A" },
  });
  const features = [...surface, ...frame, ...accessories];
  return model("办公桌", "赛博工厂工作站使用的宽幅办公桌，包含穿线孔、线缆托盘和控制导轨。", features, [
    group("cyber-desk-surface", "桌面组件", surface),
    group("cyber-desk-frame", "支撑框架", frame),
    group("cyber-desk-accessories", "线缆管理", accessories),
  ]);
}
