import type { CreateModelInput, ModelReferenceInstance, Vector3Tuple } from "../../types.js";

export interface CyberOfficeSpaceModelIds {
  roomId: string;
  deskId: string;
  monitorId: string;
  laptopId: string;
  chairId: string;
}

export function createCyberOfficeSpaceModel(ids: CyberOfficeSpaceModelIds): CreateModelInput {
  const floorThickness = 160;
  const finishedFloorY = 0;
  const deskSurfaceY = finishedFloorY + 760;
  const laptopClearance = 10;
  const stationCount = 4;
  const deskScale: Vector3Tuple = [1.25, 1, 1.1];
  const connectedDeskWidth = 2000;
  const connectedDeskDepth = 836;
  const stationVariations = [
    { laptopX: -185, laptopZ: 32, laptopYaw: -9, laptopAngle: 0, chairX: 105, chairZ: 55, chairYaw: -13, monitorXs: [-30], monitorYaw: 4 },
    { laptopX: 150, laptopZ: -18, laptopYaw: 7, laptopAngle: 78, chairX: -75, chairZ: -35, chairYaw: 10, monitorXs: [-390, 350], monitorYaw: -2 },
    { laptopX: -95, laptopZ: 44, laptopYaw: -5, laptopAngle: 112, chairX: 135, chairZ: -60, chairYaw: -8, monitorXs: [145], monitorYaw: -5 },
    { laptopX: 205, laptopZ: 8, laptopYaw: 11, laptopAngle: 94, chairX: -120, chairZ: 72, chairYaw: 15, monitorXs: [-335, 405], monitorYaw: 3 },
    { laptopX: 175, laptopZ: -38, laptopYaw: -10, laptopAngle: 0, chairX: -95, chairZ: 48, chairYaw: 12, monitorXs: [-120], monitorYaw: 5 },
    { laptopX: -145, laptopZ: 24, laptopYaw: 6, laptopAngle: 126, chairX: 125, chairZ: -75, chairYaw: -14, monitorXs: [-410, 330], monitorYaw: -3 },
    { laptopX: 75, laptopZ: -46, laptopYaw: -7, laptopAngle: 68, chairX: -145, chairZ: 30, chairYaw: 9, monitorXs: [110], monitorYaw: 6 },
    { laptopX: -210, laptopZ: 15, laptopYaw: 9, laptopAngle: 104, chairX: 80, chairZ: 68, chairYaw: -11, monitorXs: [-360, 385], monitorYaw: 2 },
  ] as const;
  const rowReferences = [
    {
      rowNumber: 1,
      deskZ: connectedDeskDepth / 2,
      deskRotation: [0, 180, 0] as Vector3Tuple,
      laptopZOffset: 170,
      laptopRotation: [0, 0, 0] as Vector3Tuple,
      chairZOffset: 1070,
      chairRotation: [0, 180, 0] as Vector3Tuple,
    },
    {
      rowNumber: 2,
      deskZ: -connectedDeskDepth / 2,
      deskRotation: [0, 0, 0] as Vector3Tuple,
      laptopZOffset: -170,
      laptopRotation: [0, 180, 0] as Vector3Tuple,
      chairZOffset: -1070,
      chairRotation: [0, 0, 0] as Vector3Tuple,
    },
  ];
  const stationReferences = rowReferences.flatMap((row) => (
    Array.from({ length: stationCount }, (_, index): ModelReferenceInstance[] => {
      const stationNumber = index + 1;
      const centerX = (index - (stationCount - 1) / 2) * connectedDeskWidth;
      const instanceSuffix = `${row.rowNumber}-${stationNumber}`;
      const displayPrefix = `第 ${row.rowNumber} 排 · 工位 ${stationNumber}`;
      const variation = stationVariations[(row.rowNumber - 1) * stationCount + index]!;
      const rowFacingSign = row.rowNumber === 1 ? 1 : -1;
      const monitorReferences: ModelReferenceInstance[] = variation.monitorXs.map((monitorX, monitorIndex) => {
        const inwardYaw = variation.monitorXs.length === 1
          ? variation.monitorYaw
          : (monitorX < 0 ? 7 : -7) * rowFacingSign + variation.monitorYaw;
        return {
          id: `cyber-office-monitor-${instanceSuffix}-${monitorIndex + 1}-reference`,
          name: `${displayPrefix} · 显示器 ${monitorIndex + 1}`,
          modelId: ids.monitorId,
          position: [
            centerX + monitorX,
            deskSurfaceY,
            row.deskZ - rowFacingSign * (145 + monitorIndex * 16),
          ],
          rotation: [0, row.laptopRotation[1] + inwardYaw, 0],
          scale: [0.88, 0.88, 0.88],
          interactions: [{
            id: "display-power",
            kind: "power",
            activateLabel: "开启显示器",
            deactivateLabel: "关闭显示器",
            range: 1350,
            targetFeatureIds: ["cyber-monitor-panel", "cyber-monitor-light-left", "cyber-monitor-light-right"],
          }],
        };
      });
      return [
        {
          id: `cyber-office-desk-${instanceSuffix}-reference`,
          name: `${displayPrefix} · 办公桌`,
          modelId: ids.deskId,
          position: [centerX, finishedFloorY, row.deskZ],
          rotation: row.deskRotation,
          scale: deskScale,
        },
        {
          id: `cyber-office-laptop-${instanceSuffix}-reference`,
          name: `${displayPrefix} · 笔记本`,
          modelId: ids.laptopId,
          position: [
            centerX + variation.laptopX,
            deskSurfaceY + laptopClearance,
            row.deskZ + row.laptopZOffset + variation.laptopZ,
          ],
          rotation: [0, row.laptopRotation[1] + variation.laptopYaw, 0],
          scale: [1, 1, 1],
          jointValues: { "cyber-laptop-screen-hinge": variation.laptopAngle },
          interactions: [{
            id: "computer-power",
            kind: "articulation",
            activateLabel: "打开笔记本",
            deactivateLabel: "合上笔记本",
            range: 1050,
            targetFeatureIds: [
              "cyber-laptop-screen-shell",
              "cyber-laptop-screen-panel",
              "cyber-laptop-camera",
            ],
            jointId: "cyber-laptop-screen-hinge",
            closedValue: 0,
            openValue: 102,
          }],
        },
        ...monitorReferences,
        {
          id: `cyber-office-chair-${instanceSuffix}-reference`,
          name: `${displayPrefix} · 人体工学椅`,
          modelId: ids.chairId,
          position: [
            centerX + variation.chairX,
            finishedFloorY,
            row.deskZ + row.chairZOffset + variation.chairZ,
          ],
          rotation: [0, row.chairRotation[1] + variation.chairYaw, 0],
          scale: [1, 1, 1],
          physics: {
            bodyType: "dynamic",
            mass: 16,
            friction: 0.42,
            linearDamping: 2.8,
          },
          interactions: [{
            id: "seat",
            kind: "seat",
            activateLabel: "坐到座椅",
            deactivateLabel: "离开座椅",
            range: 680,
            targetFeatureIds: ["cyber-chair-seat"],
          }],
        },
      ];
    }).flat()
  ));
  const references: ModelReferenceInstance[] = [{
    id: "cyber-office-room-reference",
    name: "房间 · 引用",
    modelId: ids.roomId,
    position: [0, -floorThickness, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    roomSurfaceMode: "interior",
    interactions: [{
      id: "door",
      kind: "door",
      activateLabel: "打开房门",
      deactivateLabel: "关闭房门",
      range: 920,
      targetFeatureIds: ["cyber-room-door", "cyber-room-door-handle"],
      openAngle: 88,
    }],
  }, ...stationReferences];
  return {
    kind: "scene",
    name: "赛博办公空间",
    description: "通过实时模型引用组成的两排八工位办公空间；连续桌面上的笔记本、显示器和椅子采用可复现的自然错落布局，并始终使用源模型的最新修订。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features: [],
      groups: [],
      references,
      navigation: {
        enabled: true,
        floorY: 0,
        bounds: [-4680, 4680, -2880, 2880],
        cellSize: 160,
        agentRadius: 260,
        agentHeight: 1720,
        start: [-3900, 2100],
      },
    },
  };
}
