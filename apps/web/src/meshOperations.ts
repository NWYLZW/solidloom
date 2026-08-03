import * as THREE from "three";
import {
  ADDITION,
  Brush,
  DIFFERENCE,
  Evaluator,
  INTERSECTION,
} from "three-bvh-csg";
import type { FeatureGroup, MeshFeature, ModelFeature, Vector3Tuple } from "@solidloom/shared";

export type BooleanOperation = "union" | "intersection" | "difference";

export function createFeatureGeometry(feature: ModelFeature): THREE.BufferGeometry {
  if (feature.type === "box") {
    return new THREE.BoxGeometry(
      feature.parameters.width,
      feature.parameters.height,
      feature.parameters.depth,
    );
  }
  if (feature.type === "cylinder") {
    return new THREE.CylinderGeometry(
      feature.parameters.radius,
      feature.parameters.radius,
      feature.parameters.height,
      64,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(feature.parameters.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(feature.parameters.normals, 3));
  geometry.setIndex(feature.parameters.indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function composeMatrix(position: Vector3Tuple, rotation: Vector3Tuple, scale: Vector3Tuple = [1, 1, 1]) {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2]),
    "XYZ",
  ));
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    quaternion,
    new THREE.Vector3(...scale),
  );
}

function featureWorldMatrix(feature: ModelFeature, groups: FeatureGroup[]) {
  const featureMatrix = composeMatrix(feature.position, feature.rotation, feature.scale);
  const parentGroup = groups.find((group) => group.featureIds.includes(feature.id));
  if (!parentGroup) return featureMatrix;
  return composeMatrix(parentGroup.position, parentGroup.rotation, parentGroup.scale).multiply(featureMatrix);
}

function brushForFeature(feature: ModelFeature, groups: FeatureGroup[]) {
  const brush = new Brush(createFeatureGeometry(feature));
  featureWorldMatrix(feature, groups).decompose(brush.position, brush.quaternion, brush.scale);
  brush.updateMatrixWorld(true);
  return brush;
}

function operationConstant(operation: BooleanOperation) {
  if (operation === "intersection") return INTERSECTION;
  if (operation === "difference") return DIFFERENCE;
  return ADDITION;
}

function evaluateBrushes(brushes: Brush[], operation: BooleanOperation) {
  if (brushes.length === 0) throw new Error("没有可求值的几何对象。");
  if (brushes.length === 1) return brushes[0]!;
  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal"];
  evaluator.useGroups = false;
  let result = brushes[0]!;
  for (const brush of brushes.slice(1)) {
    result = evaluator.evaluate(result, brush, operationConstant(operation));
    result.updateMatrixWorld(true);
  }
  return result;
}

function worldGeometryFromBrush(brush: Brush) {
  brush.updateMatrixWorld(true);
  const geometry = brush.geometry.clone();
  geometry.applyMatrix4(brush.matrixWorld);
  geometry.clearGroups();
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("color");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) {
    geometry.dispose();
    throw new Error("几何运算没有产生有效实体，请检查对象是否相交。");
  }
  return geometry;
}

function serializeGeometry(geometry: THREE.BufferGeometry, name: string): MeshFeature {
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeVertexNormals();
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const indices = geometry.index
    ? Array.from(geometry.index.array, Number)
    : Array.from({ length: position.count }, (_, index) => index);
  const feature: MeshFeature = {
    id: globalThis.crypto.randomUUID(),
    name,
    type: "mesh",
    operation: "add",
    position: [center.x, center.y, center.z],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    parameters: {
      positions: Array.from(position.array, Number),
      normals: Array.from(normal.array, Number),
      indices,
    },
  };
  geometry.dispose();
  return feature;
}

export function evaluateBoolean(
  features: ModelFeature[],
  groups: FeatureGroup[],
  operation: BooleanOperation,
  name: string,
) {
  const brushes = features.map((feature) => brushForFeature(feature, groups));
  try {
    const resultBrush = evaluateBrushes(brushes, operation);
    const resultGeometry = worldGeometryFromBrush(resultBrush);
    if (!brushes.includes(resultBrush)) resultBrush.geometry.dispose();
    return serializeGeometry(resultGeometry, name);
  } finally {
    brushes.forEach((brush) => brush.geometry.dispose());
  }
}

export function evaluatePlaneCut(
  features: ModelFeature[],
  groups: FeatureGroup[],
  rotation: Vector3Tuple,
  offset: number,
  keepPositive: boolean,
  name: string,
) {
  const sourceBrushes = features.map((feature) => brushForFeature(feature, groups));
  let sourceGeometry: THREE.BufferGeometry | null = null;
  let cutterGeometry: THREE.BufferGeometry | null = null;
  try {
    const sourceResult = evaluateBrushes(sourceBrushes, "union");
    sourceGeometry = worldGeometryFromBrush(sourceResult);
    if (!sourceBrushes.includes(sourceResult)) sourceResult.geometry.dispose();
    const bounds = new THREE.Box3().setFromBufferAttribute(sourceGeometry.getAttribute("position") as THREE.BufferAttribute);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z, 1) * 6 + Math.abs(offset) * 2;
    const normal = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(rotation[0]),
      THREE.MathUtils.degToRad(rotation[1]),
      THREE.MathUtils.degToRad(rotation[2]),
      "XYZ",
    )).normalize();
    if (!keepPositive) normal.negate();
    const planePoint = center.clone().addScaledVector(normal, offset);
    cutterGeometry = new THREE.BoxGeometry(span * 2, span, span * 2);
    const cutter = new Brush(cutterGeometry);
    cutter.position.copy(planePoint).addScaledVector(normal, span / 2);
    cutter.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    cutter.updateMatrixWorld(true);

    const source = new Brush(sourceGeometry);
    source.updateMatrixWorld(true);
    const evaluator = new Evaluator();
    evaluator.attributes = ["position", "normal"];
    evaluator.useGroups = false;
    const resultBrush = evaluator.evaluate(source, cutter, INTERSECTION);
    const resultGeometry = worldGeometryFromBrush(resultBrush);
    resultBrush.geometry.dispose();
    return serializeGeometry(resultGeometry, name);
  } finally {
    sourceBrushes.forEach((brush) => brush.geometry.dispose());
    sourceGeometry?.dispose();
    cutterGeometry?.dispose();
  }
}
