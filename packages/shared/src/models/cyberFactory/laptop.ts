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

export function createLaptop(): CreateModelInput {
  // The screen's lower-front edge is anchored to the base's rear-right edge;
  // its thinner shell extends behind the deck instead of into it.
  const screenCenter: Vector3Tuple = [0, 135.42, -150.45];
  const screenRotation: Vector3Tuple = [-12, 0, 0];
  const screenPosition = (offset: Vector3Tuple) => offsetWithXRotation(screenCenter, offset, screenRotation[0]);
  const base = [
    withAppearance(
      recessedLaptopDeck(
        "cyber-laptop-base",
        "机身底座",
        [380, 9, 260],
        [0, 4.5, 10],
        [
          { center: [0, -35], size: [326, 122], depth: 2.2 },
          { center: [0, 90], size: [136, 70], depth: 2.2 },
        ],
        10,
        3.6,
      ),
      "metal",
      "#97A2AA",
    ),
    withAppearance(
      box("cyber-laptop-keyboard", "键盘面板", [320, 1.2, 116], [0, 7.7, -25], origin, { radius: 2, algorithm: "smooth" }),
      "plastic",
      "#30383D",
    ),
    withAppearance(
      box("cyber-laptop-trackpad", "触控板", [130, 1.2, 64], [0, 7.7, 100], origin, { radius: 2, algorithm: "smooth" }),
      "glass",
      "#5F7380",
    ),
  ];
  const screen = [
    withAppearance(
      recessedRoundedPanel(
        "cyber-laptop-screen-shell",
        "屏幕外壳",
        [380, 260, 7],
        [370, 250, 3],
        screenCenter,
        screenRotation,
        6,
        3,
        3,
      ),
      "metal",
      "#87949E",
    ),
    withAppearance(
      box("cyber-laptop-screen-panel", "显示屏", [368, 248, 1], screenPosition([0, 0, 1]), screenRotation, { radius: 0.5, algorithm: "smooth" }),
      "glass",
      "#102A38",
    ),
    withAppearance(
      box("cyber-laptop-camera", "屏幕摄像头", [18, 3.5, 0.6], screenPosition([0, 127.25, 1.8]), screenRotation, { radius: 0.3, algorithm: "circular" }),
      "plastic",
      "#11171B",
    ),
  ];
  const features = [...base, ...screen];
  const laptop = model("笔记本", "带可调屏幕转轴的轻薄赛博笔记本，包含内嵌简化键盘、前置触控板和窄边框内嵌显示屏。", features, [
    group("cyber-laptop-base-group", "键盘底座", base),
    group("cyber-laptop-screen-group", "屏幕组件", screen),
  ]);
  laptop.featureGraph!.joints = [{
    id: "cyber-laptop-screen-hinge",
    name: "屏幕转轴",
    type: "revolute",
    groupId: "cyber-laptop-screen-group",
    pivot: [0, 9, -120],
    axis: [-1, 0, 0],
    value: 102,
    restValue: 102,
    min: 0,
    max: 135,
  }];
  return laptop;
}
