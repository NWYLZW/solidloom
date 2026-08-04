import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ADDITION,
  Brush,
  DIFFERENCE,
  Evaluator,
  INTERSECTION,
} from "three-bvh-csg";
import {
  BOX_CORNER_KEYS,
  boxCornerRadiiAreUniform,
  clampBoxCornerRadii,
  resolveBoxCornerRadii,
  type BoxCornerRadii,
  type FeatureGroup,
  type MeshFeature,
  type ModelFeature,
  type Vector3Tuple,
} from "@solidloom/shared";

export type BooleanOperation = "union" | "intersection" | "difference";

function interpolateCornerRadius(radii: BoxCornerRadii, xAmount: number, yAmount: number, zAmount: number) {
  const bottomNear = THREE.MathUtils.lerp(radii.xMinYMinZMin, radii.xMaxYMinZMin, xAmount);
  const bottomFar = THREE.MathUtils.lerp(radii.xMinYMinZMax, radii.xMaxYMinZMax, xAmount);
  const topNear = THREE.MathUtils.lerp(radii.xMinYMaxZMin, radii.xMaxYMaxZMin, xAmount);
  const topFar = THREE.MathUtils.lerp(radii.xMinYMaxZMax, radii.xMaxYMaxZMax, xAmount);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(bottomNear, bottomFar, zAmount),
    THREE.MathUtils.lerp(topNear, topFar, zAmount),
    yAmount,
  );
}

function roundedAxisCoordinates(halfExtent: number, radii: BoxCornerRadii, samplesPerRadius: number) {
  const values = [-halfExtent, 0, halfExtent];
  const uniqueRadii = [...new Set(BOX_CORNER_KEYS.map((key) => Math.min(radii[key], halfExtent)).filter((radius) => radius > 1e-6))];
  for (const radius of uniqueRadii) {
    for (let sample = 1; sample <= samplesPerRadius; sample += 1) {
      const offset = radius * sample / samplesPerRadius;
      values.push(-halfExtent + offset, halfExtent - offset);
    }
  }
  return values
    .sort((left, right) => left - right)
    .filter((value, index, sorted) => index === 0 || Math.abs(value - sorted[index - 1]!) > 1e-6);
}

function createAsymmetricRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radii: BoxCornerRadii,
  samplesPerRadius: number,
) {
  const halfExtents = [width / 2, height / 2, depth / 2] as const;
  const coordinates = halfExtents.map((halfExtent) => roundedAxisCoordinates(halfExtent, radii, samplesPerRadius));
  const positions: number[] = [];
  const indices: number[] = [];
  const point = new THREE.Vector3();
  const innerPoint = new THREE.Vector3();
  const delta = new THREE.Vector3();

  const addRoundedPoint = (source: Vector3Tuple) => {
    point.set(...source);
    const radius = interpolateCornerRadius(
      radii,
      (point.x + halfExtents[0]) / width,
      (point.y + halfExtents[1]) / height,
      (point.z + halfExtents[2]) / depth,
    );
    if (radius > 1e-6) {
      innerPoint.set(
        THREE.MathUtils.clamp(point.x, -halfExtents[0] + radius, halfExtents[0] - radius),
        THREE.MathUtils.clamp(point.y, -halfExtents[1] + radius, halfExtents[1] - radius),
        THREE.MathUtils.clamp(point.z, -halfExtents[2] + radius, halfExtents[2] - radius),
      );
      delta.subVectors(point, innerPoint);
      if (delta.lengthSq() > 1e-12) point.copy(innerPoint).add(delta.normalize().multiplyScalar(radius));
    }
    positions.push(point.x, point.y, point.z);
  };

  const faces = [
    { axis: 0, sign: 1, u: 1, v: 2, reverse: false },
    { axis: 0, sign: -1, u: 1, v: 2, reverse: true },
    { axis: 1, sign: 1, u: 2, v: 0, reverse: false },
    { axis: 1, sign: -1, u: 2, v: 0, reverse: true },
    { axis: 2, sign: 1, u: 0, v: 1, reverse: false },
    { axis: 2, sign: -1, u: 0, v: 1, reverse: true },
  ] as const;

  for (const face of faces) {
    const uCoordinates = coordinates[face.u]!;
    const vCoordinates = coordinates[face.v]!;
    const offset = positions.length / 3;
    for (const vCoordinate of vCoordinates) {
      for (const uCoordinate of uCoordinates) {
        const source: Vector3Tuple = [0, 0, 0];
        source[face.axis] = halfExtents[face.axis] * face.sign;
        source[face.u] = uCoordinate;
        source[face.v] = vCoordinate;
        addRoundedPoint(source);
      }
    }
    for (let vIndex = 0; vIndex < vCoordinates.length - 1; vIndex += 1) {
      for (let uIndex = 0; uIndex < uCoordinates.length - 1; uIndex += 1) {
        const rowLength = uCoordinates.length;
        const a = offset + vIndex * rowLength + uIndex;
        const b = a + 1;
        const d = offset + (vIndex + 1) * rowLength + uIndex;
        const c = d + 1;
        if (face.reverse) indices.push(a, c, b, a, d, c);
        else indices.push(a, b, c, a, c, d);
      }
    }
  }

  const sourceGeometry = new THREE.BufferGeometry();
  sourceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  sourceGeometry.setIndex(indices);
  const mergedGeometry = mergeVertices(sourceGeometry, 1e-5);
  sourceGeometry.dispose();
  const geometry = toCreasedNormals(mergedGeometry);
  mergedGeometry.dispose();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createFeatureGeometry(feature: ModelFeature): THREE.BufferGeometry {
  if (feature.type === "box") {
    const maximumRadius = Math.min(
      feature.parameters.width,
      feature.parameters.height,
      feature.parameters.depth,
    ) / 2;
    const radii = clampBoxCornerRadii(resolveBoxCornerRadii(feature.parameters), maximumRadius);
    const radius = radii[BOX_CORNER_KEYS[0]];
    const largestRadius = Math.max(...BOX_CORNER_KEYS.map((key) => radii[key]));
    if (largestRadius > 0) {
      const segments = feature.parameters.cornerAlgorithm === "smooth" ? 8 : 3;
      if (!boxCornerRadiiAreUniform(radii)) {
        return createAsymmetricRoundedBoxGeometry(
          feature.parameters.width,
          feature.parameters.height,
          feature.parameters.depth,
          radii,
          feature.parameters.cornerAlgorithm === "smooth" ? 4 : 2,
        );
      }
      return new RoundedBoxGeometry(
        feature.parameters.width,
        feature.parameters.height,
        feature.parameters.depth,
        segments,
        radius,
      );
    }
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
      32,
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

export function featureGeometryCacheKey(feature: ModelFeature): string | null {
  if (feature.type === "mesh") return null;
  return `${feature.type}:${JSON.stringify(feature.parameters)}`;
}

export function featureVolume(feature: ModelFeature) {
  const geometry = createFeatureGeometry(feature);
  try {
    const position = geometry.getAttribute("position");
    const index = geometry.index;
    const triangleCount = index ? index.count / 3 : position.count / 3;
    let signedVolume = 0;
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const aIndex = (index ? index.getX(triangle * 3) : triangle * 3) * 3;
      const bIndex = (index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1) * 3;
      const cIndex = (index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2) * 3;
      const ax = position.array[aIndex] ?? 0;
      const ay = position.array[aIndex + 1] ?? 0;
      const az = position.array[aIndex + 2] ?? 0;
      const bx = position.array[bIndex] ?? 0;
      const by = position.array[bIndex + 1] ?? 0;
      const bz = position.array[bIndex + 2] ?? 0;
      const cx = position.array[cIndex] ?? 0;
      const cy = position.array[cIndex + 1] ?? 0;
      const cz = position.array[cIndex + 2] ?? 0;
      signedVolume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
    }
    const scale = feature.scale ?? [1, 1, 1];
    return Math.abs(signedVolume / 6) * Math.abs(scale[0] * scale[1] * scale[2]);
  } finally {
    geometry.dispose();
  }
}

export function featureTriangleCount(feature: ModelFeature) {
  const geometry = createFeatureGeometry(feature);
  try {
    return geometry.index
      ? Math.floor(geometry.index.count / 3)
      : Math.floor(geometry.getAttribute("position").count / 3);
  } finally {
    geometry.dispose();
  }
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
