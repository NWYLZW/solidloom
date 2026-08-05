import type { MeshFeature, Vector3Tuple } from "../../types.js";
import { origin, roundedRectangleLoop } from "./primitives.js";

function recessedRoundedPanel(
  id: string,
  name: string,
  size: Vector3Tuple,
  recessSize: Vector3Tuple,
  position: Vector3Tuple,
  rotation: Vector3Tuple,
  outerRadius: number,
  recessRadius: number,
  backFilletRadius: number,
): MeshFeature {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const addTriangle = (a: Vector3Tuple, b: Vector3Tuple, c: Vector3Tuple) => {
    const ab: Vector3Tuple = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac: Vector3Tuple = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross: Vector3Tuple = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const length = Math.hypot(...cross) || 1;
    const normal = cross.map((value) => value / length) as Vector3Tuple;
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c);
    normals.push(...normal, ...normal, ...normal);
    indices.push(start, start + 1, start + 2);
  };
  const addQuad = (a: Vector3Tuple, b: Vector3Tuple, c: Vector3Tuple, d: Vector3Tuple) => {
    addTriangle(a, b, c);
    addTriangle(a, c, d);
  };
  const addTriangleWithNormals = (
    a: Vector3Tuple,
    normalA: Vector3Tuple,
    b: Vector3Tuple,
    normalB: Vector3Tuple,
    c: Vector3Tuple,
    normalC: Vector3Tuple,
  ) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c);
    normals.push(...normalA, ...normalB, ...normalC);
    indices.push(start, start + 1, start + 2);
  };
  const addQuadWithNormals = (
    a: Vector3Tuple,
    normalA: Vector3Tuple,
    b: Vector3Tuple,
    normalB: Vector3Tuple,
    c: Vector3Tuple,
    normalC: Vector3Tuple,
    d: Vector3Tuple,
    normalD: Vector3Tuple,
  ) => {
    addTriangleWithNormals(a, normalA, b, normalB, c, normalC);
    addTriangleWithNormals(a, normalA, c, normalC, d, normalD);
  };

  const segments = 8;
  const backDepth = -size[2] / 2;
  const frontDepth = size[2] / 2;
  const floorDepth = frontDepth - recessSize[2];
  const outerLoop = roundedRectangleLoop(size[0], size[1], outerRadius, segments);
  const recessLoop = roundedRectangleLoop(recessSize[0], recessSize[1], recessRadius, segments);
  const atDepth = (point: Vector3Tuple, depth: number): Vector3Tuple => [point[0], point[1], depth];

  const horizontalNormal = (point: Vector3Tuple, width: number, height: number, radius: number): Vector3Tuple => {
    const coreX = Math.max(-width / 2 + radius, Math.min(width / 2 - radius, point[0]));
    const coreY = Math.max(-height / 2 + radius, Math.min(height / 2 - radius, point[1]));
    const deltaX = point[0] - coreX;
    const deltaY = point[1] - coreY;
    const length = Math.hypot(deltaX, deltaY) || 1;
    return [deltaX / length, deltaY / length, 0];
  };
  const outerNormals = outerLoop.map((point) => horizontalNormal(point, size[0], size[1], outerRadius));
  const filletRadius = Math.min(
    Math.max(backFilletRadius, 0),
    size[2] / 2,
    outerRadius,
  );
  const sideBackDepth = backDepth + filletRadius;

  for (let index = 0; index < outerLoop.length; index += 1) {
    const next = (index + 1) % outerLoop.length;
    const outerBack = atDepth(outerLoop[index]!, sideBackDepth);
    const outerBackNext = atDepth(outerLoop[next]!, sideBackDepth);
    const outerFront = atDepth(outerLoop[index]!, frontDepth);
    const outerFrontNext = atDepth(outerLoop[next]!, frontDepth);
    const recessFront = atDepth(recessLoop[index]!, frontDepth);
    const recessFrontNext = atDepth(recessLoop[next]!, frontDepth);
    const recessFloor = atDepth(recessLoop[index]!, floorDepth);
    const recessFloorNext = atDepth(recessLoop[next]!, floorDepth);
    addQuadWithNormals(
      outerBack, outerNormals[index]!,
      outerBackNext, outerNormals[next]!,
      outerFrontNext, outerNormals[next]!,
      outerFront, outerNormals[index]!,
    );
    addQuad(outerFront, outerFrontNext, recessFrontNext, recessFront);
    addQuad(recessFront, recessFrontNext, recessFloorNext, recessFloor);
  }

  const filletSegments = 10;
  const filletRings = Array.from({ length: filletSegments + 1 }, (_, segment) => {
    const angle = segment * Math.PI / 2 / filletSegments;
    const inset = filletRadius * (1 - Math.cos(angle));
    const width = size[0] - inset * 2;
    const height = size[1] - inset * 2;
    const radius = Math.max(outerRadius - inset, 0.001);
    const loop = roundedRectangleLoop(width, height, radius, segments);
    const normalScale = Math.cos(angle);
    return {
      depth: backDepth + filletRadius * (1 - Math.sin(angle)),
      loop,
      normals: loop.map((point): Vector3Tuple => {
        const normal = horizontalNormal(point, width, height, radius);
        return [normal[0] * normalScale, normal[1] * normalScale, -Math.sin(angle)];
      }),
    };
  });
  for (let ringIndex = 0; ringIndex < filletRings.length - 1; ringIndex += 1) {
    const ring = filletRings[ringIndex]!;
    const nextRing = filletRings[ringIndex + 1]!;
    for (let index = 0; index < ring.loop.length; index += 1) {
      const next = (index + 1) % ring.loop.length;
      addQuadWithNormals(
        atDepth(ring.loop[index]!, ring.depth), ring.normals[index]!,
        atDepth(nextRing.loop[index]!, nextRing.depth), nextRing.normals[index]!,
        atDepth(nextRing.loop[next]!, nextRing.depth), nextRing.normals[next]!,
        atDepth(ring.loop[next]!, ring.depth), ring.normals[next]!,
      );
    }
  }

  const backLoop = filletRings[filletRings.length - 1]!.loop;
  const backCenter: Vector3Tuple = [0, 0, backDepth];
  const floorCenter: Vector3Tuple = [0, 0, floorDepth];
  for (let index = 0; index < backLoop.length; index += 1) {
    const next = (index + 1) % backLoop.length;
    addTriangleWithNormals(
      backCenter, [0, 0, -1],
      atDepth(backLoop[next]!, backDepth), [0, 0, -1],
      atDepth(backLoop[index]!, backDepth), [0, 0, -1],
    );
  }
  for (let index = 0; index < recessLoop.length; index += 1) {
    const next = (index + 1) % recessLoop.length;
    addTriangle(floorCenter, atDepth(recessLoop[index]!, floorDepth), atDepth(recessLoop[next]!, floorDepth));
  }

  return {
    id,
    name,
    type: "mesh",
    operation: "add",
    position,
    rotation,
    parameters: {
      positions,
      normals,
      indices,
      source: {
        kind: "recessed-panel",
        size: [...size] as Vector3Tuple,
        recessSize: [...recessSize] as Vector3Tuple,
        outlineRadius: outerRadius,
        recessRadius,
        edgeFilletRadius: backFilletRadius,
      },
    },
  };
}

function recessedLaptopDeck(
  id: string,
  name: string,
  size: Vector3Tuple,
  position: Vector3Tuple,
  recesses: Array<{ center: [number, number]; size: [number, number]; depth: number }>,
  outerRadius: number,
  bottomFilletRadius: number,
): MeshFeature {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const addTriangle = (a: Vector3Tuple, b: Vector3Tuple, c: Vector3Tuple) => {
    const ab: Vector3Tuple = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac: Vector3Tuple = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross: Vector3Tuple = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const length = Math.hypot(...cross) || 1;
    const normal = cross.map((value) => value / length) as Vector3Tuple;
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c);
    normals.push(...normal, ...normal, ...normal);
    indices.push(start, start + 1, start + 2);
  };
  const addQuad = (a: Vector3Tuple, b: Vector3Tuple, c: Vector3Tuple, d: Vector3Tuple) => {
    addTriangle(a, b, c);
    addTriangle(a, c, d);
  };
  const addTriangleWithNormals = (
    a: Vector3Tuple,
    normalA: Vector3Tuple,
    b: Vector3Tuple,
    normalB: Vector3Tuple,
    c: Vector3Tuple,
    normalC: Vector3Tuple,
  ) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c);
    normals.push(...normalA, ...normalB, ...normalC);
    indices.push(start, start + 1, start + 2);
  };
  const addQuadWithNormals = (
    a: Vector3Tuple,
    normalA: Vector3Tuple,
    b: Vector3Tuple,
    normalB: Vector3Tuple,
    c: Vector3Tuple,
    normalC: Vector3Tuple,
    d: Vector3Tuple,
    normalD: Vector3Tuple,
  ) => {
    addTriangleWithNormals(a, normalA, b, normalB, c, normalC);
    addTriangleWithNormals(a, normalA, c, normalC, d, normalD);
  };
  const addHorizontalQuad = (xMin: number, xMax: number, zMin: number, zMax: number, y: number) => {
    addQuad([xMin, y, zMin], [xMin, y, zMax], [xMax, y, zMax], [xMax, y, zMin]);
  };

  const halfWidth = size[0] / 2;
  const halfHeight = size[1] / 2;
  const halfDepth = size[2] / 2;
  const radius = Math.min(outerRadius, halfWidth, halfDepth);
  const innerHalfWidth = halfWidth - radius;
  const innerHalfDepth = halfDepth - radius;
  const topY = halfHeight;
  const bottomY = -halfHeight;
  const bounds = recesses.map((recess) => ({
    xMin: recess.center[0] - recess.size[0] / 2,
    xMax: recess.center[0] + recess.size[0] / 2,
    zMin: recess.center[1] - recess.size[1] / 2,
    zMax: recess.center[1] + recess.size[1] / 2,
    floorY: topY - recess.depth,
  }));
  const xCoordinates = [...new Set([
    -innerHalfWidth,
    innerHalfWidth,
    ...bounds.flatMap((recess) => [recess.xMin, recess.xMax]),
  ])].sort((left, right) => left - right);
  const zCoordinates = [...new Set([
    -halfDepth,
    halfDepth,
    ...bounds.flatMap((recess) => [recess.zMin, recess.zMax]),
  ])].sort((left, right) => left - right);

  for (let xIndex = 0; xIndex < xCoordinates.length - 1; xIndex += 1) {
    for (let zIndex = 0; zIndex < zCoordinates.length - 1; zIndex += 1) {
      const xMin = xCoordinates[xIndex]!;
      const xMax = xCoordinates[xIndex + 1]!;
      const zMin = zCoordinates[zIndex]!;
      const zMax = zCoordinates[zIndex + 1]!;
      const centerX = (xMin + xMax) / 2;
      const centerZ = (zMin + zMax) / 2;
      if (bounds.some((recess) => centerX > recess.xMin && centerX < recess.xMax && centerZ > recess.zMin && centerZ < recess.zMax)) continue;
      addHorizontalQuad(xMin, xMax, zMin, zMax, topY);
    }
  }

  addHorizontalQuad(-halfWidth, -innerHalfWidth, -innerHalfDepth, innerHalfDepth, topY);
  addHorizontalQuad(innerHalfWidth, halfWidth, -innerHalfDepth, innerHalfDepth, topY);
  const cornerSegments = 10;
  for (const startAngle of [0, 90, 180, 270]) {
    const centerX = Math.cos((startAngle + 45) * Math.PI / 180) > 0 ? innerHalfWidth : -innerHalfWidth;
    const centerZ = Math.sin((startAngle + 45) * Math.PI / 180) > 0 ? innerHalfDepth : -innerHalfDepth;
    const center: Vector3Tuple = [centerX, topY, centerZ];
    for (let segment = 0; segment < cornerSegments; segment += 1) {
      const firstAngle = (startAngle + segment * 90 / cornerSegments) * Math.PI / 180;
      const secondAngle = (startAngle + (segment + 1) * 90 / cornerSegments) * Math.PI / 180;
      const first: Vector3Tuple = [centerX + Math.cos(firstAngle) * radius, topY, centerZ + Math.sin(firstAngle) * radius];
      const second: Vector3Tuple = [centerX + Math.cos(secondAngle) * radius, topY, centerZ + Math.sin(secondAngle) * radius];
      addTriangle(center, second, first);
    }
  }

  for (const recess of bounds) {
    addHorizontalQuad(recess.xMin, recess.xMax, recess.zMin, recess.zMax, recess.floorY);
    addQuad(
      [recess.xMin, topY, recess.zMin],
      [recess.xMin, recess.floorY, recess.zMin],
      [recess.xMax, recess.floorY, recess.zMin],
      [recess.xMax, topY, recess.zMin],
    );
    addQuad(
      [recess.xMin, topY, recess.zMax],
      [recess.xMax, topY, recess.zMax],
      [recess.xMax, recess.floorY, recess.zMax],
      [recess.xMin, recess.floorY, recess.zMax],
    );
    addQuad(
      [recess.xMin, topY, recess.zMin],
      [recess.xMin, topY, recess.zMax],
      [recess.xMin, recess.floorY, recess.zMax],
      [recess.xMin, recess.floorY, recess.zMin],
    );
    addQuad(
      [recess.xMax, topY, recess.zMin],
      [recess.xMax, recess.floorY, recess.zMin],
      [recess.xMax, recess.floorY, recess.zMax],
      [recess.xMax, topY, recess.zMax],
    );
  }

  const horizontalNormal = (point: Vector3Tuple, width: number, depth: number, loopRadius: number): Vector3Tuple => {
    const x = point[0];
    const z = point[1];
    const coreX = Math.max(-width / 2 + loopRadius, Math.min(width / 2 - loopRadius, x));
    const coreZ = Math.max(-depth / 2 + loopRadius, Math.min(depth / 2 - loopRadius, z));
    const deltaX = x - coreX;
    const deltaZ = z - coreZ;
    const length = Math.hypot(deltaX, deltaZ) || 1;
    return [deltaX / length, 0, deltaZ / length];
  };
  const outerLoop = roundedRectangleLoop(size[0], size[2], radius, cornerSegments);
  const outerNormals = outerLoop.map((point) => horizontalNormal(point, size[0], size[2], radius));
  const filletRadius = Math.min(Math.max(bottomFilletRadius, 0), halfHeight, radius);
  const sideBottomY = bottomY + filletRadius;
  for (let index = 0; index < outerLoop.length; index += 1) {
    const next = (index + 1) % outerLoop.length;
    const current = outerLoop[index]!;
    const following = outerLoop[next]!;
    addQuadWithNormals(
      [current[0], topY, current[1]], outerNormals[index]!,
      [following[0], topY, following[1]], outerNormals[next]!,
      [following[0], sideBottomY, following[1]], outerNormals[next]!,
      [current[0], sideBottomY, current[1]], outerNormals[index]!,
    );
  }

  const filletSegments = 10;
  const filletRings = Array.from({ length: filletSegments + 1 }, (_, segment) => {
    const angle = segment * Math.PI / 2 / filletSegments;
    const inset = filletRadius * (1 - Math.cos(angle));
    const y = bottomY + filletRadius * (1 - Math.sin(angle));
    const width = size[0] - inset * 2;
    const depth = size[2] - inset * 2;
    const loopRadius = Math.max(radius - inset, 0.001);
    const loop = roundedRectangleLoop(width, depth, loopRadius, cornerSegments);
    const normalScale = Math.cos(angle);
    return {
      loop,
      normals: loop.map((point): Vector3Tuple => {
        const normal = horizontalNormal(point, width, depth, loopRadius);
        return [normal[0] * normalScale, -Math.sin(angle), normal[2] * normalScale];
      }),
      y,
    };
  });
  for (let ringIndex = 0; ringIndex < filletRings.length - 1; ringIndex += 1) {
    const ring = filletRings[ringIndex]!;
    const nextRing = filletRings[ringIndex + 1]!;
    for (let index = 0; index < ring.loop.length; index += 1) {
      const next = (index + 1) % ring.loop.length;
      const current = ring.loop[index]!;
      const following = ring.loop[next]!;
      const nextCurrent = nextRing.loop[index]!;
      const nextFollowing = nextRing.loop[next]!;
      addQuadWithNormals(
        [current[0], ring.y, current[1]], ring.normals[index]!,
        [following[0], ring.y, following[1]], ring.normals[next]!,
        [nextFollowing[0], nextRing.y, nextFollowing[1]], nextRing.normals[next]!,
        [nextCurrent[0], nextRing.y, nextCurrent[1]], nextRing.normals[index]!,
      );
    }
  }

  const bottomLoop = filletRings[filletRings.length - 1]!.loop;
  const bottomCenter: Vector3Tuple = [0, bottomY, 0];
  const bottomNormal: Vector3Tuple = [0, -1, 0];
  for (let index = 0; index < bottomLoop.length; index += 1) {
    const next = (index + 1) % bottomLoop.length;
    const current = bottomLoop[index]!;
    const following = bottomLoop[next]!;
    addTriangleWithNormals(
      bottomCenter, bottomNormal,
      [current[0], bottomY, current[1]], bottomNormal,
      [following[0], bottomY, following[1]], bottomNormal,
    );
  }

  return {
    id,
    name,
    type: "mesh",
    operation: "add",
    position,
    rotation: origin,
    parameters: {
      positions,
      normals,
      indices,
      source: {
        kind: "recessed-deck",
        size: [...size] as Vector3Tuple,
        recesses: recesses.map((recess) => ({
          center: [...recess.center] as [number, number],
          size: [...recess.size] as [number, number],
          depth: recess.depth,
        })),
        outlineRadius: outerRadius,
        edgeFilletRadius: bottomFilletRadius,
      },
    },
  };
}

export { recessedLaptopDeck, recessedRoundedPanel };
