import type { CreateModelInput } from "../../types.js";
import {
  box,
  cylinder,
  group,
  model,
  withFeatureAppearances,
} from "./factory.js";

export interface OfficeMonitorParameters {
  width: number;
  panelHeight: number;
  overallHeight: number;
}

export const officeMonitorParameterLimits = {
  width: { minimum: 520, maximum: 820, step: 10 },
  panelHeight: { minimum: 300, maximum: 480, step: 10 },
  overallHeight: { minimum: 620, maximum: 880, step: 10 },
} as const;

export const defaultOfficeMonitorParameters: OfficeMonitorParameters = {
  width: 670,
  panelHeight: 400,
  overallHeight: 730,
};

export const officeMonitorFeatureIds = {
  shell: "cyber-monitor-shell",
  panel: "cyber-monitor-panel",
  camera: "cyber-monitor-camera",
  cameraLens: "cyber-monitor-camera-lens",
  hinge: "cyber-monitor-hinge",
  neck: "cyber-monitor-neck",
  base: "cyber-monitor-base",
  baseBevel: "cyber-monitor-base-bevel",
  lightLeft: "cyber-monitor-light-left",
  lightRight: "cyber-monitor-light-right",
  control: "cyber-monitor-control",
} as const;

export const officeMonitorGroupIds = {
  display: "cyber-monitor-display",
  stand: "cyber-monitor-stand",
  accents: "cyber-monitor-accents",
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) throw new Error("显示器尺寸必须是有限数值。");
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeOfficeMonitorParameters(
  input: Partial<OfficeMonitorParameters> = {},
): OfficeMonitorParameters {
  const panelHeight = clamp(input.panelHeight ?? defaultOfficeMonitorParameters.panelHeight, 300, 480);
  return {
    width: clamp(input.width ?? defaultOfficeMonitorParameters.width, 520, 820),
    panelHeight,
    overallHeight: clamp(
      input.overallHeight ?? defaultOfficeMonitorParameters.overallHeight,
      panelHeight + 180,
      880,
    ),
  };
}

export function createMonitor(input: Partial<OfficeMonitorParameters> = {}): CreateModelInput {
  const parameters = normalizeOfficeMonitorParameters(input);
  const displayCenterY = parameters.overallHeight - parameters.panelHeight / 2 - 30;
  const panelWidth = parameters.width - 42;
  const cameraY = parameters.overallHeight - 12;
  const hingeY = displayCenterY - parameters.panelHeight / 2 + 30;
  const neckHeight = Math.max(190, hingeY - 60);
  const display = withFeatureAppearances([
    box(officeMonitorFeatureIds.shell, "显示器外壳", [parameters.width, parameters.panelHeight, 34], [0, displayCenterY, 0]),
    box(officeMonitorFeatureIds.panel, "显示面板", [panelWidth, parameters.panelHeight - 46, 8], [0, displayCenterY, 21]),
    box(officeMonitorFeatureIds.camera, "顶部摄像头", [72, 24, 26], [0, cameraY, -8]),
    cylinder(officeMonitorFeatureIds.cameraLens, "摄像头镜头", 8, 8, [0, cameraY, 25], [90, 0, 0]),
  ], { material: "plastic", color: "#263138" }, {
    [officeMonitorFeatureIds.panel]: { material: "glass", color: "#173A49" },
    [officeMonitorFeatureIds.camera]: { material: "plastic", color: "#151C20" },
    [officeMonitorFeatureIds.cameraLens]: { material: "glass", color: "#58BFD4" },
  });
  const stand = withFeatureAppearances([
    cylinder(officeMonitorFeatureIds.hinge, "俯仰转轴", 38, 110, [0, hingeY, -8], [0, 0, 90]),
    box(officeMonitorFeatureIds.neck, "升降支柱", [68, neckHeight, 54], [0, 60 + neckHeight / 2, -34]),
    box(officeMonitorFeatureIds.base, "稳定底座", [360, 22, 235], [0, 11, 45]),
    box(officeMonitorFeatureIds.baseBevel, "底座前沿", [300, 18, 60], [0, 24, -70], [8, 0, 0]),
  ], { material: "metal", color: "#748188" });
  const accents = withFeatureAppearances([
    box(officeMonitorFeatureIds.lightLeft, "左氛围灯", [10, parameters.panelHeight - 120, 12], [-parameters.width / 2 + 21, displayCenterY, 19]),
    box(officeMonitorFeatureIds.lightRight, "右氛围灯", [10, parameters.panelHeight - 120, 12], [parameters.width / 2 - 21, displayCenterY, 19]),
    cylinder(officeMonitorFeatureIds.control, "控制旋钮", 16, 14, [parameters.width / 2 - 75, displayCenterY - parameters.panelHeight / 2 + 6, 25], [90, 0, 0]),
  ], { material: "plastic", color: "#71D7DE" }, {
    [officeMonitorFeatureIds.control]: { material: "metal", color: "#B5C0C5" },
  });
  const features = [...display, ...stand, ...accents];
  return model("电脑显示器", "带摄像头、升降支架和双侧氛围灯的真实毫米尺度办公显示器。", features, [
    group(officeMonitorGroupIds.display, "显示组件", display),
    group(officeMonitorGroupIds.stand, "显示器支架", stand),
    group(officeMonitorGroupIds.accents, "交互细节", accents),
  ]);
}
