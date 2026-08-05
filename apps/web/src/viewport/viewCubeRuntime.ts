import * as THREE from "three";
import { createAxisLabel, createTextTexture } from "./scenePrimitives";

export interface ViewCubeRuntime {
  axisCamera: THREE.OrthographicCamera;
  axisScene: THREE.Scene;
  dispose: () => void;
  faceDefinitions: Array<{
    normal: THREE.Vector3;
    right: THREE.Vector3;
    up: THREE.Vector3;
  }>;
  gridCellHoverMaterial: THREE.MeshBasicMaterial;
  gridCellMaterial: THREE.MeshBasicMaterial;
  gridCellMeshes: THREE.Mesh[];
  orientationGroup: THREE.Group;
  viewCube: THREE.Mesh;
}

export function createViewCubeRuntime(
  axisWidget: HTMLCanvasElement,
  viewLabels: [string, string, string, string, string, string],
): ViewCubeRuntime {
  const axisScene = new THREE.Scene();
  const axisCamera = new THREE.OrthographicCamera(-2.65, 2.65, 2.65, -2.65, 0.1, 20);
  axisCamera.position.set(0, 0, 6);
  const orientationGroup = new THREE.Group();
  axisScene.add(orientationGroup);

  const widgetStyle = window.getComputedStyle(axisWidget);
  const faceColor = widgetStyle.getPropertyValue("--axis-face-color").trim() || "#464a43";
  const faceTextColor = widgetStyle.getPropertyValue("--axis-face-text").trim() || "#f2f3ef";
  const faceMaterials = viewLabels.map((faceLabel) => new THREE.MeshBasicMaterial({
    map: createTextTexture(faceLabel, faceColor, faceTextColor),
  }));
  const viewCubeSize = 2;
  const viewCubeGeometry = new THREE.BoxGeometry(viewCubeSize, viewCubeSize, viewCubeSize);
  const viewCube = new THREE.Mesh(viewCubeGeometry, faceMaterials);
  orientationGroup.add(viewCube);

  const faceDefinitions = [
    { normal: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(-1, 0, 0), right: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(0, 1, 0), right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, -1) },
    { normal: new THREE.Vector3(0, -1, 0), right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, 1) },
    { normal: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
  ];
  const gridCellSize = viewCubeSize / 3;
  const gridCellGeometry = new THREE.PlaneGeometry(gridCellSize - 0.025, gridCellSize - 0.025);
  const gridCellMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const gridCellHoverMaterial = new THREE.MeshBasicMaterial({
    color: 0xd6a06f,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  const gridCellMeshes: THREE.Mesh[] = [];
  const planeNormal = new THREE.Vector3(0, 0, 1);
  for (const [faceIndex, face] of faceDefinitions.entries()) {
    for (const verticalOffset of [-1, 0, 1]) {
      for (const horizontalOffset of [-1, 0, 1]) {
        const cell = new THREE.Mesh(gridCellGeometry, gridCellMaterial);
        cell.position
          .copy(face.normal)
          .multiplyScalar(viewCubeSize / 2 + 0.006)
          .addScaledVector(face.right, horizontalOffset * gridCellSize)
          .addScaledVector(face.up, verticalOffset * gridCellSize);
        cell.quaternion.setFromUnitVectors(planeNormal, face.normal);
        cell.userData.faceIndex = faceIndex;
        cell.userData.viewDirection = face.normal.clone()
          .addScaledVector(face.right, horizontalOffset)
          .addScaledVector(face.up, verticalOffset)
          .normalize();
        cell.renderOrder = 5;
        orientationGroup.add(cell);
        gridCellMeshes.push(cell);
      }
    }
  }

  const cubeEdgesGeometry = new THREE.EdgesGeometry(viewCubeGeometry);
  const cubeEdgesMaterial = new THREE.LineBasicMaterial({
    color: 0xaeb3aa,
    transparent: true,
    opacity: 0.52,
  });
  orientationGroup.add(new THREE.LineSegments(cubeEdgesGeometry, cubeEdgesMaterial));

  const axisDefinitions = [
    { name: "X", direction: new THREE.Vector3(1, 0, 0), color: 0xd77878 },
    { name: "Y", direction: new THREE.Vector3(0, 1, 0), color: 0x70c98a },
    { name: "Z", direction: new THREE.Vector3(0, 0, 1), color: 0x7e8fe0 },
  ];
  const axisOrigin = new THREE.Vector3(-1, -1, -1);
  const axisArrows: THREE.ArrowHelper[] = [];
  const axisLabels: THREE.Sprite[] = [];
  for (const axis of axisDefinitions) {
    const arrow = new THREE.ArrowHelper(axis.direction, axisOrigin, 2.85, axis.color, 0.3, 0.17);
    const lineMaterial = arrow.line.material as THREE.LineBasicMaterial;
    const coneMaterial = arrow.cone.material as THREE.MeshBasicMaterial;
    lineMaterial.depthTest = true;
    lineMaterial.transparent = true;
    lineMaterial.opacity = 0.9;
    coneMaterial.depthTest = true;
    arrow.line.renderOrder = 10;
    arrow.cone.renderOrder = 10;
    orientationGroup.add(arrow);
    axisArrows.push(arrow);

    const axisLabel = createAxisLabel(axis.name, `#${axis.color.toString(16).padStart(6, "0")}`);
    axisLabel.position.copy(axisOrigin).addScaledVector(axis.direction, 3.05);
    orientationGroup.add(axisLabel);
    axisLabels.push(axisLabel);
  }

  return {
    axisCamera,
    axisScene,
    faceDefinitions,
    gridCellHoverMaterial,
    gridCellMaterial,
    gridCellMeshes,
    orientationGroup,
    viewCube,
    dispose: () => {
      viewCubeGeometry.dispose();
      cubeEdgesGeometry.dispose();
      cubeEdgesMaterial.dispose();
      gridCellGeometry.dispose();
      gridCellMaterial.dispose();
      gridCellHoverMaterial.dispose();
      for (const material of faceMaterials) {
        material.map?.dispose();
        material.dispose();
      }
      for (const arrow of axisArrows) arrow.dispose();
      for (const axisLabel of axisLabels) {
        axisLabel.material.map?.dispose();
        axisLabel.material.dispose();
      }
    },
  };
}
