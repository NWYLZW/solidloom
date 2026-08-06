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

export function createChair(): CreateModelInput {
  const base = withFeatureAppearances([
    cylinder("cyber-chair-column", "升降气杆", 38, 420, [0, 275, 0]),
    cylinder("cyber-chair-hub", "五星脚中心", 86, 55, [0, 72, 0]),
    ...[0, 72, 144, 216, 288].flatMap((angle, index) => {
      const radians = angle * Math.PI / 180;
      const x = Math.cos(radians) * 150;
      const z = Math.sin(radians) * 150;
      const wheelX = Math.cos(radians) * 305;
      const wheelZ = Math.sin(radians) * 305;
      return [
        box(`cyber-chair-leg-${index + 1}`, `五星脚 ${index + 1}`, [330, 34, 54], [x, 68, z], [0, -angle, 0]),
        cylinder(`cyber-chair-wheel-${index + 1}`, `脚轮 ${index + 1}`, 38, 28, [wheelX, 38, wheelZ], [90, 0, angle]),
      ];
    }),
  ], { material: "metal", color: "#657279" }, Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [
      `cyber-chair-wheel-${index + 1}`,
      { material: "rubber", color: "#262C2F" } satisfies AppearanceDefinition,
    ]),
  ));
  const seat = withFeatureAppearances([
    box("cyber-chair-seat", "坐垫", [520, 78, 480], [0, 525, -5], [-4, 0, 0]),
    box("cyber-chair-seat-front", "瀑布前沿", [480, 92, 90], [0, 510, 220], [8, 0, 0]),
    box("cyber-chair-back", "人体工学靠背", [500, 650, 74], [0, 875, -205], [-8, 0, 0]),
    box("cyber-chair-lumbar", "腰部支撑", [380, 125, 54], [0, 760, -155], [-8, 0, 0]),
    box("cyber-chair-headrest", "头枕", [330, 135, 68], [0, 1235, -250], [-10, 0, 0]),
  ], { material: "fabric", color: "#627780" }, {
    "cyber-chair-seat": { material: "fabric", color: "#71868E" },
    "cyber-chair-seat-front": { material: "fabric", color: "#71868E" },
    "cyber-chair-lumbar": { material: "fabric", color: "#82969D" },
  });
  const arms = withFeatureAppearances([
    box("cyber-chair-arm-post-left", "左扶手立柱", [42, 280, 42], [-310, 690, -5]),
    box("cyber-chair-arm-post-right", "右扶手立柱", [42, 280, 42], [310, 690, -5]),
    box("cyber-chair-arm-left", "左扶手", [92, 42, 330], [-310, 835, -45]),
    box("cyber-chair-arm-right", "右扶手", [92, 42, 330], [310, 835, -45]),
    cylinder("cyber-chair-recline", "后仰调节旋钮", 44, 36, [292, 520, -130], [0, 0, 90]),
  ], { material: "plastic", color: "#37444A" }, {
    "cyber-chair-arm-post-left": { material: "metal", color: "#66757B" },
    "cyber-chair-arm-post-right": { material: "metal", color: "#66757B" },
    "cyber-chair-recline": { material: "plastic", color: "#AECF42" },
  });
  const features = [...base, ...seat, ...arms];
  return model("简易人体工学椅", "带五星脚、腰托、头枕和可调扶手的简易人体工学椅。", features, [
    group("cyber-chair-base-group", "移动底座", base),
    group("cyber-chair-seat-group", "坐垫与靠背", seat),
    group("cyber-chair-arm-group", "扶手与调节", arms),
  ]);
}
