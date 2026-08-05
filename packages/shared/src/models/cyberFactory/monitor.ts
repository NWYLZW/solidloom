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

export function createMonitor(): CreateModelInput {
  const display = withFeatureAppearances([
    box("cyber-monitor-shell", "显示器外壳", [670, 400, 34], [0, 500, 0]),
    box("cyber-monitor-panel", "显示面板", [628, 354, 8], [0, 500, 21]),
    box("cyber-monitor-camera", "顶部摄像头", [72, 24, 26], [0, 718, -8]),
    cylinder("cyber-monitor-camera-lens", "摄像头镜头", 8, 8, [0, 718, 25], [90, 0, 0]),
  ], { material: "plastic", color: "#263138" }, {
    "cyber-monitor-panel": { material: "glass", color: "#173A49" },
    "cyber-monitor-camera": { material: "plastic", color: "#151C20" },
    "cyber-monitor-camera-lens": { material: "glass", color: "#58BFD4" },
  });
  const stand = withFeatureAppearances([
    cylinder("cyber-monitor-hinge", "俯仰转轴", 38, 110, [0, 330, -8], [0, 0, 90]),
    box("cyber-monitor-neck", "升降支柱", [68, 270, 54], [0, 205, -34]),
    box("cyber-monitor-base", "稳定底座", [360, 22, 235], [0, 11, 45]),
    box("cyber-monitor-base-bevel", "底座前沿", [300, 18, 60], [0, 24, -70], [8, 0, 0]),
  ], { material: "metal", color: "#748188" });
  const accents = withFeatureAppearances([
    box("cyber-monitor-light-left", "左氛围灯", [10, 280, 12], [-314, 500, 19]),
    box("cyber-monitor-light-right", "右氛围灯", [10, 280, 12], [314, 500, 19]),
    cylinder("cyber-monitor-control", "控制旋钮", 16, 14, [260, 306, 25], [90, 0, 0]),
  ], { material: "plastic", color: "#71D7DE" }, {
    "cyber-monitor-control": { material: "metal", color: "#B5C0C5" },
  });
  const features = [...display, ...stand, ...accents];
  return model("电脑显示器", "带摄像头、升降支架和双侧氛围灯的赛博风显示器。", features, [
    group("cyber-monitor-display", "显示组件", display),
    group("cyber-monitor-stand", "显示器支架", stand),
    group("cyber-monitor-accents", "交互细节", accents),
  ]);
}
