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

export function createFigure(): CreateModelInput {
  const body = withFeatureAppearances([
    sphere("cyber-figure-head", "头部", 110, [0, 1660, 0]),
    cylinder("cyber-figure-torso", "躯干中轴", 30, 560, [0, 1280, 0]),
  ], { material: "plastic", color: "#A9B9B5" }, {
    "cyber-figure-head": { material: "plastic", color: "#C1CDC9" },
  });
  const leftShoulder = withFeatureAppearances([
    cylinder("cyber-figure-upper-arm-left", "左上臂", 26, 320, [-82.5, 1342, 0], [0, 0, -31]),
  ], { material: "metal", color: "#8EA3A3" });
  const rightShoulder = withFeatureAppearances([
    cylinder("cyber-figure-upper-arm-right", "右上臂", 26, 320, [82.5, 1342, 0], [0, 0, 31]),
  ], { material: "metal", color: "#8EA3A3" });
  const leftHip = withFeatureAppearances([
    cylinder("cyber-figure-upper-leg-left", "左大腿", 30, 475, [-38.75, 764, 0], [0, 0, -10]),
  ], { material: "metal", color: "#8EA3A3" });
  const rightHip = withFeatureAppearances([
    cylinder("cyber-figure-upper-leg-right", "右大腿", 30, 475, [38.75, 764, 0], [0, 0, 10]),
  ], { material: "metal", color: "#8EA3A3" });
  const leftElbow = withFeatureAppearances([
    cylinder("cyber-figure-forearm-left", "左前臂", 26, 320, [-247.5, 1068, 0], [0, 0, -31]),
    sphere("cyber-figure-hand-left", "左手", 48, [-330, 931, 0]),
  ], { material: "metal", color: "#8EA3A3" });
  const rightElbow = withFeatureAppearances([
    cylinder("cyber-figure-forearm-right", "右前臂", 26, 320, [247.5, 1068, 0], [0, 0, 31]),
    sphere("cyber-figure-hand-right", "右手", 48, [330, 931, 0]),
  ], { material: "metal", color: "#8EA3A3" });
  const leftKnee = withFeatureAppearances([
    cylinder("cyber-figure-lower-leg-left", "左小腿", 30, 475, [-121.25, 296, 0], [0, 0, -10]),
    ellipsoid("cyber-figure-foot-left", "左脚", [78, 42, 138], [-162, 50, 55]),
  ], { material: "metal", color: "#8EA3A3" });
  const rightKnee = withFeatureAppearances([
    cylinder("cyber-figure-lower-leg-right", "右小腿", 30, 475, [121.25, 296, 0], [0, 0, 10]),
    ellipsoid("cyber-figure-foot-right", "右脚", [78, 42, 138], [162, 50, 55]),
  ], { material: "metal", color: "#8EA3A3" });
  const features = [...body, ...leftShoulder, ...rightShoulder, ...leftHip, ...rightHip, ...leftElbow, ...rightElbow, ...leftKnee, ...rightKnee];
  const figure = model("极简风小人", "由球形头部、躯干中轴、可弯曲四肢和圆润端点构成的关节火柴人，用于空间尺度、姿态和场景角色参考。", features, [
    group("cyber-figure-body-group", "身体中轴", body),
    group("cyber-figure-left-shoulder-group", "左肩以下", leftShoulder),
    group("cyber-figure-right-shoulder-group", "右肩以下", rightShoulder),
    group("cyber-figure-left-elbow-group", "左肘以下", leftElbow),
    group("cyber-figure-right-elbow-group", "右肘以下", rightElbow),
    group("cyber-figure-left-hip-group", "左髋以下", leftHip),
    group("cyber-figure-right-hip-group", "右髋以下", rightHip),
    group("cyber-figure-left-knee-group", "左膝以下", leftKnee),
    group("cyber-figure-right-knee-group", "右膝以下", rightKnee),
  ]);
  figure.featureGraph!.joints = [
    { id: "cyber-figure-left-shoulder", name: "左肩", type: "revolute", groupId: "cyber-figure-left-shoulder-group", pivot: [0, 1479, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -130, max: 65 },
    { id: "cyber-figure-right-shoulder", name: "右肩", type: "revolute", groupId: "cyber-figure-right-shoulder-group", pivot: [0, 1479, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -130, max: 65 },
    { id: "cyber-figure-left-elbow", name: "左手肘", type: "revolute", groupId: "cyber-figure-left-elbow-group", parentJointId: "cyber-figure-left-shoulder", pivot: [-165, 1205, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -135, max: 25 },
    { id: "cyber-figure-right-elbow", name: "右手肘", type: "revolute", groupId: "cyber-figure-right-elbow-group", parentJointId: "cyber-figure-right-shoulder", pivot: [165, 1205, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -135, max: 25 },
    { id: "cyber-figure-left-hip", name: "左髋", type: "revolute", groupId: "cyber-figure-left-hip-group", pivot: [0, 998, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -65, max: 45 },
    { id: "cyber-figure-right-hip", name: "右髋", type: "revolute", groupId: "cyber-figure-right-hip-group", pivot: [0, 998, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -65, max: 45 },
    { id: "cyber-figure-left-knee", name: "左膝", type: "revolute", groupId: "cyber-figure-left-knee-group", parentJointId: "cyber-figure-left-hip", pivot: [-80, 530, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: 0, max: 120 },
    { id: "cyber-figure-right-knee", name: "右膝", type: "revolute", groupId: "cyber-figure-right-knee-group", parentJointId: "cyber-figure-right-hip", pivot: [80, 530, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: 0, max: 120 },
  ];
  figure.featureGraph!.poses = [
    { id: "cyber-figure-pose-stand", name: "站立", durationMs: 650, jointValues: { "cyber-figure-left-shoulder": 0, "cyber-figure-right-shoulder": 0, "cyber-figure-left-elbow": 0, "cyber-figure-right-elbow": 0, "cyber-figure-left-hip": 0, "cyber-figure-right-hip": 0, "cyber-figure-left-knee": 0, "cyber-figure-right-knee": 0 } },
    { id: "cyber-figure-pose-wave", name: "招手", durationMs: 720, jointValues: { "cyber-figure-left-shoulder": -118, "cyber-figure-right-shoulder": 0, "cyber-figure-left-elbow": -72, "cyber-figure-right-elbow": 0, "cyber-figure-left-hip": 0, "cyber-figure-right-hip": 0, "cyber-figure-left-knee": 0, "cyber-figure-right-knee": 0 } },
    { id: "cyber-figure-pose-crouch", name: "屈膝", durationMs: 820, jointValues: { "cyber-figure-left-shoulder": -18, "cyber-figure-right-shoulder": -18, "cyber-figure-left-elbow": -28, "cyber-figure-right-elbow": -28, "cyber-figure-left-hip": -20, "cyber-figure-right-hip": -20, "cyber-figure-left-knee": 72, "cyber-figure-right-knee": 72 } },
  ];
  figure.featureGraph!.animations = [
    {
      id: "cyber-figure-animation-walk",
      name: "走路",
      durationMs: 1_080,
      loop: true,
      keyframes: [
        { offset: 0, jointValues: { "cyber-figure-left-shoulder": 24, "cyber-figure-right-shoulder": -26, "cyber-figure-left-elbow": -14, "cyber-figure-right-elbow": -20, "cyber-figure-left-hip": -28, "cyber-figure-right-hip": 22, "cyber-figure-left-knee": 6, "cyber-figure-right-knee": 18 } },
        { offset: 0.25, jointValues: { "cyber-figure-left-shoulder": 2, "cyber-figure-right-shoulder": -4, "cyber-figure-left-elbow": -18, "cyber-figure-right-elbow": -24, "cyber-figure-left-hip": 5, "cyber-figure-right-hip": -8, "cyber-figure-left-knee": 10, "cyber-figure-right-knee": 58 } },
        { offset: 0.5, jointValues: { "cyber-figure-left-shoulder": -26, "cyber-figure-right-shoulder": 24, "cyber-figure-left-elbow": -20, "cyber-figure-right-elbow": -14, "cyber-figure-left-hip": 22, "cyber-figure-right-hip": -28, "cyber-figure-left-knee": 18, "cyber-figure-right-knee": 6 } },
        { offset: 0.75, jointValues: { "cyber-figure-left-shoulder": -4, "cyber-figure-right-shoulder": 2, "cyber-figure-left-elbow": -24, "cyber-figure-right-elbow": -18, "cyber-figure-left-hip": -8, "cyber-figure-right-hip": 5, "cyber-figure-left-knee": 58, "cyber-figure-right-knee": 10 } },
        { offset: 1, jointValues: { "cyber-figure-left-shoulder": 24, "cyber-figure-right-shoulder": -26, "cyber-figure-left-elbow": -14, "cyber-figure-right-elbow": -20, "cyber-figure-left-hip": -28, "cyber-figure-right-hip": 22, "cyber-figure-left-knee": 6, "cyber-figure-right-knee": 18 } },
      ],
    },
    {
      id: "cyber-figure-animation-run",
      name: "奔跑",
      durationMs: 640,
      loop: true,
      keyframes: [
        { offset: 0, jointValues: { "cyber-figure-left-shoulder": 38, "cyber-figure-right-shoulder": -46, "cyber-figure-left-elbow": -58, "cyber-figure-right-elbow": -72, "cyber-figure-left-hip": -46, "cyber-figure-right-hip": 32, "cyber-figure-left-knee": 12, "cyber-figure-right-knee": 68 } },
        { offset: 0.25, jointValues: { "cyber-figure-left-shoulder": 4, "cyber-figure-right-shoulder": -8, "cyber-figure-left-elbow": -64, "cyber-figure-right-elbow": -78, "cyber-figure-left-hip": 8, "cyber-figure-right-hip": -24, "cyber-figure-left-knee": 42, "cyber-figure-right-knee": 96 } },
        { offset: 0.5, jointValues: { "cyber-figure-left-shoulder": -46, "cyber-figure-right-shoulder": 38, "cyber-figure-left-elbow": -72, "cyber-figure-right-elbow": -58, "cyber-figure-left-hip": 32, "cyber-figure-right-hip": -46, "cyber-figure-left-knee": 68, "cyber-figure-right-knee": 12 } },
        { offset: 0.75, jointValues: { "cyber-figure-left-shoulder": -8, "cyber-figure-right-shoulder": 4, "cyber-figure-left-elbow": -78, "cyber-figure-right-elbow": -64, "cyber-figure-left-hip": -24, "cyber-figure-right-hip": 8, "cyber-figure-left-knee": 96, "cyber-figure-right-knee": 42 } },
        { offset: 1, jointValues: { "cyber-figure-left-shoulder": 38, "cyber-figure-right-shoulder": -46, "cyber-figure-left-elbow": -58, "cyber-figure-right-elbow": -72, "cyber-figure-left-hip": -46, "cyber-figure-right-hip": 32, "cyber-figure-left-knee": 12, "cyber-figure-right-knee": 68 } },
      ],
    },
  ];
  figure.featureGraph!.locomotion = {
    id: "cyber-figure-locomotion",
    name: "移动速度",
    walkAnimationId: "cyber-figure-animation-walk",
    runAnimationId: "cyber-figure-animation-run",
    defaultSpeed: 0,
    minimumSpeed: 0,
    maximumSpeed: 5,
    walkReferenceSpeed: 1.4,
    runReferenceSpeed: 3.6,
    transitionStartSpeed: 1.7,
    transitionEndSpeed: 2.7,
    transitionDurationMs: 420,
  };
  return figure;
}
