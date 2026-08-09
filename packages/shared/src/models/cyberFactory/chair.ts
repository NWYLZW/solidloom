import type { CreateModelInput } from "../../types.js";
import {
  box,
  cylinder,
  group,
  model,
  withFeatureAppearances,
  type AppearanceDefinition,
} from "./factory.js";

export interface OfficeChairParameters {
  seatWidth: number;
  seatDepth: number;
  seatHeight: number;
  backHeight: number;
}

export const officeChairParameterLimits = {
  seatWidth: { minimum: 460, maximum: 620, step: 10 },
  seatDepth: { minimum: 420, maximum: 560, step: 10 },
  seatHeight: { minimum: 400, maximum: 520, step: 10 },
  backHeight: { minimum: 560, maximum: 760, step: 10 },
} as const;

export const defaultOfficeChairParameters: OfficeChairParameters = {
  seatWidth: 520,
  seatDepth: 480,
  seatHeight: 460,
  backHeight: 650,
};

export const officeChairFeatureIds = {
  column: "cyber-chair-column",
  hub: "cyber-chair-hub",
  seat: "cyber-chair-seat",
  seatFront: "cyber-chair-seat-front",
  back: "cyber-chair-back",
  lumbar: "cyber-chair-lumbar",
  headrest: "cyber-chair-headrest",
  armPostLeft: "cyber-chair-arm-post-left",
  armPostRight: "cyber-chair-arm-post-right",
  armLeft: "cyber-chair-arm-left",
  armRight: "cyber-chair-arm-right",
  recline: "cyber-chair-recline",
} as const;

export const officeChairLegFeatureId = (index: number) => `cyber-chair-leg-${index + 1}`;
export const officeChairWheelFeatureId = (index: number) => `cyber-chair-wheel-${index + 1}`;

export const officeChairGroupIds = {
  base: "cyber-chair-base-group",
  seat: "cyber-chair-seat-group",
  arms: "cyber-chair-arm-group",
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) throw new Error("办公椅尺寸必须是有限数值。");
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeOfficeChairParameters(
  input: Partial<OfficeChairParameters> = {},
): OfficeChairParameters {
  return {
    seatWidth: clamp(input.seatWidth ?? defaultOfficeChairParameters.seatWidth, 460, 620),
    seatDepth: clamp(input.seatDepth ?? defaultOfficeChairParameters.seatDepth, 420, 560),
    seatHeight: clamp(input.seatHeight ?? defaultOfficeChairParameters.seatHeight, 400, 520),
    backHeight: clamp(input.backHeight ?? defaultOfficeChairParameters.backHeight, 560, 760),
  };
}

export function createChair(input: Partial<OfficeChairParameters> = {}): CreateModelInput {
  const parameters = normalizeOfficeChairParameters(input);
  const wheelRadius = 32;
  const wheelOffset = Math.max(285, parameters.seatWidth * 0.585);
  const legHalfOffset = wheelOffset / 2;
  const columnBottom = 92;
  const seatCushionHeight = 72;
  const seatBottom = parameters.seatHeight - seatCushionHeight;
  const columnHeight = seatBottom - columnBottom;
  const base = withFeatureAppearances([
    cylinder(officeChairFeatureIds.column, "升降气杆", 38, columnHeight, [0, columnBottom + columnHeight / 2, 0]),
    cylinder(officeChairFeatureIds.hub, "五星脚中心", 82, 52, [0, 70, 0]),
    ...[0, 72, 144, 216, 288].flatMap((angle, index) => {
      const radians = angle * Math.PI / 180;
      const x = Math.cos(radians) * legHalfOffset;
      const z = Math.sin(radians) * legHalfOffset;
      const wheelX = Math.cos(radians) * wheelOffset;
      const wheelZ = Math.sin(radians) * wheelOffset;
      return [
        box(officeChairLegFeatureId(index), `五星脚 ${index + 1}`, [wheelOffset + 25, 32, 52], [x, 62, z], [0, -angle, 0]),
        cylinder(officeChairWheelFeatureId(index), `脚轮 ${index + 1}`, wheelRadius, 28, [wheelX, wheelRadius, wheelZ], [90, 0, angle]),
      ];
    }),
  ], { material: "metal", color: "#657279" }, Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [
      officeChairWheelFeatureId(index),
      { material: "rubber", color: "#262C2F" } satisfies AppearanceDefinition,
    ]),
  ));
  const backBottom = parameters.seatHeight + 18;
  const headrestHeight = 130;
  const seat = withFeatureAppearances([
    box(officeChairFeatureIds.seat, "坐垫", [parameters.seatWidth, seatCushionHeight, parameters.seatDepth], [0, parameters.seatHeight - seatCushionHeight / 2, -5], [-4, 0, 0]),
    box(officeChairFeatureIds.seatFront, "瀑布前沿", [parameters.seatWidth - 40, 82, 90], [0, parameters.seatHeight - 46, parameters.seatDepth / 2 - 20], [8, 0, 0]),
    box(officeChairFeatureIds.back, "人体工学靠背", [parameters.seatWidth - 20, parameters.backHeight, 74], [0, backBottom + parameters.backHeight / 2, -parameters.seatDepth / 2 + 35], [-8, 0, 0]),
    box(officeChairFeatureIds.lumbar, "腰部支撑", [parameters.seatWidth - 140, 125, 54], [0, parameters.seatHeight + 235, -parameters.seatDepth / 2 + 78], [-8, 0, 0]),
    box(officeChairFeatureIds.headrest, "头枕", [Math.min(360, parameters.seatWidth - 170), headrestHeight, 68], [0, backBottom + parameters.backHeight + headrestHeight / 2, -parameters.seatDepth / 2 - 10], [-10, 0, 0]),
  ], { material: "fabric", color: "#627780" }, {
    [officeChairFeatureIds.seat]: { material: "fabric", color: "#71868E" },
    [officeChairFeatureIds.seatFront]: { material: "fabric", color: "#71868E" },
    [officeChairFeatureIds.lumbar]: { material: "fabric", color: "#82969D" },
  });
  const armX = parameters.seatWidth / 2 + 50;
  const armTopY = parameters.seatHeight + 285;
  const arms = withFeatureAppearances([
    box(officeChairFeatureIds.armPostLeft, "左扶手立柱", [42, 250, 42], [-armX, armTopY - 125, -5]),
    box(officeChairFeatureIds.armPostRight, "右扶手立柱", [42, 250, 42], [armX, armTopY - 125, -5]),
    box(officeChairFeatureIds.armLeft, "左扶手", [92, 42, Math.min(330, parameters.seatDepth - 120)], [-armX, armTopY, -45]),
    box(officeChairFeatureIds.armRight, "右扶手", [92, 42, Math.min(330, parameters.seatDepth - 120)], [armX, armTopY, -45]),
    cylinder(officeChairFeatureIds.recline, "后仰调节旋钮", 44, 36, [parameters.seatWidth / 2 + 32, parameters.seatHeight - 5, -parameters.seatDepth * 0.27], [0, 0, 90]),
  ], { material: "plastic", color: "#37444A" }, {
    [officeChairFeatureIds.armPostLeft]: { material: "metal", color: "#66757B" },
    [officeChairFeatureIds.armPostRight]: { material: "metal", color: "#66757B" },
    [officeChairFeatureIds.recline]: { material: "plastic", color: "#AECF42" },
  });
  const features = [...base, ...seat, ...arms];
  return model("简易人体工学椅", "按真实座高重做的可移动人体工学椅，带五星脚、腰托、头枕和可调扶手。", features, [
    group(officeChairGroupIds.base, "移动底座", base),
    group(officeChairGroupIds.seat, "坐垫与靠背", seat),
    group(officeChairGroupIds.arms, "扶手与调节", arms),
  ]);
}
