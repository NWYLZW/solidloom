import type { RefObject } from "react";
import * as THREE from "three";

interface AnnotationProjectorOptions {
  camera: THREE.Camera;
  container: HTMLElement;
  featureGroupById: Map<string, THREE.Group>;
  featureMeshById: Map<string, THREE.Mesh>;
  overlayRef: RefObject<HTMLDivElement | null>;
}

interface AnnotationPoint {
  x: number;
  y: number;
}

function cross(origin: AnnotationPoint, a: AnnotationPoint, b: AnnotationPoint) {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function createHull(points: AnnotationPoint[]) {
  const uniquePoints = [...new Map(points.map((point) => [
    `${Math.round(point.x * 4)}:${Math.round(point.y * 4)}`,
    point,
  ])).values()].sort((a, b) => a.x - b.x || a.y - b.y);
  if (uniquePoints.length <= 3) return uniquePoints;
  const lower: AnnotationPoint[] = [];
  for (const point of uniquePoints) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: AnnotationPoint[] = [];
  for (let index = uniquePoints.length - 1; index >= 0; index -= 1) {
    const point = uniquePoints[index]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

export function createAnnotationProjector({
  camera,
  container,
  featureGroupById,
  featureMeshById,
  overlayRef,
}: AnnotationProjectorOptions) {
  const projectionMatrix = new THREE.Matrix4();
  const frustum = new THREE.Frustum();
  const bounds = new THREE.Box3();
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();

  return () => {
    const overlay = overlayRef.current;
    if (!overlay || overlay.childElementCount === 0) return;

    camera.updateMatrixWorld(true);
    projectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionMatrix);
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.getWorldPosition(cameraPosition);
    const labelsByTargetId = new Map(
      [...overlay.querySelectorAll<HTMLElement>("[data-annotation-label-for]")]
        .map((element) => [element.dataset.annotationLabelFor ?? "", element]),
    );

    overlay.querySelectorAll<HTMLElement>("[data-annotation-kind]").forEach((element) => {
      const id = element.dataset.annotationId;
      const kind = element.dataset.annotationKind;
      const targetLabel = labelsByTargetId.get(element.id);
      const object = id
        ? kind === "group" ? featureGroupById.get(id) : featureMeshById.get(id)
        : null;
      if (!object) {
        element.hidden = true;
        if (targetLabel) targetLabel.hidden = true;
        return;
      }

      bounds.setFromObject(object);
      if (bounds.isEmpty() || !frustum.intersectsBox(bounds)) {
        element.hidden = true;
        if (targetLabel) targetLabel.hidden = true;
        return;
      }

      object.updateWorldMatrix(true, true);
      const projectedPoints: AnnotationPoint[] = [];
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || typeof child.userData.featureId !== "string") return;
        const position = child.geometry.getAttribute("position");
        if (!position) return;
        const samplingStep = Math.max(1, Math.floor(position.count / 480));
        for (let index = 0; index < position.count; index += samplingStep) {
          vertex
            .set(position.getX(index), position.getY(index), position.getZ(index))
            .applyMatrix4(child.matrixWorld)
            .applyMatrix4(camera.matrixWorldInverse);
          if (vertex.z >= 0) continue;
          vertex.applyMatrix4(camera.projectionMatrix);
          projectedPoints.push({
            x: THREE.MathUtils.clamp((vertex.x + 1) * width / 2, 0, width),
            y: THREE.MathUtils.clamp((1 - vertex.y) * height / 2, 0, height),
          });
        }
      });
      const hull = createHull(projectedPoints);
      if (hull.length < 3) {
        element.hidden = true;
        if (targetLabel) targetLabel.hidden = true;
        return;
      }

      const left = Math.min(...hull.map((point) => point.x));
      const right = Math.max(...hull.map((point) => point.x));
      const top = Math.min(...hull.map((point) => point.y));
      const bottom = Math.max(...hull.map((point) => point.y));
      const targetWidth = Math.max(20, right - left);
      const targetHeight = Math.max(20, bottom - top);
      const polygonPoints = hull.map((point) => ({
        x: THREE.MathUtils.clamp((point.x - left) / targetWidth * 100, 0, 100),
        y: THREE.MathUtils.clamp((point.y - top) / targetHeight * 100, 0, 100),
      }));
      const polygonCss = `polygon(${polygonPoints.map((point) => `${point.x.toFixed(2)}% ${point.y.toFixed(2)}%`).join(", ")})`;
      const polygonSvg = polygonPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
      bounds.getCenter(center);
      const distance = center.distanceTo(cameraPosition);
      const targetZIndex = kind === "feature" ? Math.max(2, 2000 - Math.round(distance)) : 1;

      element.hidden = false;
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.style.width = `${targetWidth}px`;
      element.style.height = `${targetHeight}px`;
      element.style.zIndex = String(targetZIndex);
      element.style.clipPath = polygonCss;
      element.querySelector("polygon")?.setAttribute("points", polygonSvg);
      if (targetLabel) {
        targetLabel.hidden = false;
        targetLabel.style.left = `${left}px`;
        targetLabel.style.top = `${top}px`;
        targetLabel.style.zIndex = String(targetZIndex + 1);
      }
    });
  };
}
