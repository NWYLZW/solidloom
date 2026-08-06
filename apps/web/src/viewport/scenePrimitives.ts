import * as THREE from "three";

export const AXIS_WIDGET_SIZE = 160;
export const DEFAULT_TRANSFORM_CONTROL_SIZE = 0.82;
export const ROTATION_RING_PADDING = 1.18;
export const GRID_DISPLAY_OFFSET = -0.5;

const GRID_MINOR_SPACING = 10;
const GRID_MAJOR_SPACING = 100;
const GRID_COARSE_SPACING = 1000;

export function createInfiniteGrid(
  minorColor: THREE.ColorRepresentation,
  majorColor: THREE.ColorRepresentation,
  extent: number,
) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      minorColor: { value: new THREE.Color(minorColor) },
      majorColor: { value: new THREE.Color(majorColor) },
      minorSpacing: { value: GRID_MINOR_SPACING },
      majorSpacing: { value: GRID_MAJOR_SPACING },
      coarseSpacing: { value: GRID_COARSE_SPACING },
    },
    vertexShader: `
      varying vec3 worldPosition;

      void main() {
        vec4 positionInWorld = modelMatrix * vec4(position, 1.0);
        worldPosition = positionInWorld.xyz;
        gl_Position = projectionMatrix * viewMatrix * positionInWorld;
      }
    `,
    fragmentShader: `
      uniform vec3 minorColor;
      uniform vec3 majorColor;
      uniform float minorSpacing;
      uniform float majorSpacing;
      uniform float coarseSpacing;
      varying vec3 worldPosition;

      float gridLine(float spacing) {
        vec2 coordinate = worldPosition.xz / spacing;
        vec2 derivativeWidth = max(fwidth(coordinate), vec2(0.0001));
        vec2 distanceToLine = abs(fract(coordinate - 0.5) - 0.5) / derivativeWidth;
        float line = 1.0 - min(min(distanceToLine.x, distanceToLine.y), 1.0);
        float detailVisibility = 1.0 - smoothstep(0.55, 1.2, max(derivativeWidth.x, derivativeWidth.y));
        return line * detailVisibility;
      }

      void main() {
        float minorLine = gridLine(minorSpacing);
        float majorLine = gridLine(majorSpacing);
        float coarseLine = gridLine(coarseSpacing);
        float planarDistance = length(cameraPosition.xz - worldPosition.xz);
        minorLine *= 1.0 - smoothstep(1200.0, 4000.0, planarDistance);
        majorLine *= 1.0 - smoothstep(5000.0, 15000.0, planarDistance);
        float opacity = max(max(minorLine * 0.48, majorLine * 0.72), coarseLine * 0.84);
        if (opacity < 0.01) discard;
        gl_FragColor = vec4(mix(minorColor, majorColor, max(majorLine, coarseLine)), opacity);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "infinite-grid";
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(extent, extent, 1);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { geometry, material, mesh };
}

export function createSelectionCornerBox(bounds: THREE.Box3, color: THREE.ColorRepresentation) {
  const cornerBox = new THREE.Group();
  cornerBox.name = "selection-corner-box";
  if (bounds.isEmpty()) return cornerBox;

  const objectSize = bounds.getSize(new THREE.Vector3());
  const maximumDimension = Math.max(objectSize.x, objectSize.y, objectSize.z, 1);
  const cornerBounds = bounds.clone();
  const cornerBoxSize = cornerBounds.getSize(new THREE.Vector3());
  const longestCornerSegment = maximumDimension * 0.18;
  const segmentLengths = new THREE.Vector3(
    Math.min(cornerBoxSize.x * 0.38, longestCornerSegment),
    Math.min(cornerBoxSize.y * 0.38, longestCornerSegment),
    Math.min(cornerBoxSize.z * 0.38, longestCornerSegment),
  );
  const thickness = Math.max(maximumDimension * 0.0042, 0.28);
  const segmentGeometry = new THREE.BoxGeometry(1, 1, 1);
  const segmentMaterial = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.96,
    toneMapped: false,
  });

  for (const useMaximumX of [false, true]) {
    for (const useMaximumY of [false, true]) {
      for (const useMaximumZ of [false, true]) {
        const corner = new THREE.Vector3(
          useMaximumX ? cornerBounds.max.x : cornerBounds.min.x,
          useMaximumY ? cornerBounds.max.y : cornerBounds.min.y,
          useMaximumZ ? cornerBounds.max.z : cornerBounds.min.z,
        );
        const inwardDirections = [useMaximumX ? -1 : 1, useMaximumY ? -1 : 1, useMaximumZ ? -1 : 1];

        for (let axis = 0; axis < 3; axis += 1) {
          const length = segmentLengths.getComponent(axis);
          const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
          segment.position.copy(corner);
          segment.position.setComponent(axis, corner.getComponent(axis) + inwardDirections[axis]! * length / 2);
          segment.scale.set(thickness, thickness, thickness);
          segment.scale.setComponent(axis, length);
          segment.renderOrder = 60;
          segment.frustumCulled = false;
          cornerBox.add(segment);
        }
      }
    }
  }

  return cornerBox;
}

export function createTextTexture(text: string, background: string, foreground: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");

  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255, 255, 255, 0.22)";
  context.lineWidth = 8;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = foreground;
  context.font = "600 54px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export function createAxisLabel(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");

  context.fillStyle = color;
  context.beginPath();
  context.arc(48, 48, 38, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "800 42px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 48, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(0.42);
  sprite.renderOrder = 20;
  return sprite;
}
