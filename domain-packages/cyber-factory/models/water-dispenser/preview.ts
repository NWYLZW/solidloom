import type { ModelFeature } from "@solidloom/shared";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createWaterDispenserAssetDefinition } from "./index.js";
import type { WaterDispenserQuality } from "./types.js";

const container = document.querySelector<HTMLElement>("#preview");
const qualityLabel = document.querySelector<HTMLElement>("#quality-label");
const metricsLabel = document.querySelector<HTMLElement>("#metrics-label");
if (!container || !qualityLabel || !metricsLabel) throw new Error("Preview shell is incomplete");
const previewContainer = container;

const requestedQuality = new URLSearchParams(window.location.search).get("quality");
const quality: WaterDispenserQuality = requestedQuality === "mobile" ? "mobile" : "desktop";
const definition = createWaterDispenserAssetDefinition();
const model = definition.createModel();
const graph = model.featureGraph!;
const previewPose = graph.poses?.find(({ id }) => id === "cabinet-door-open");
const lod = definition.manifest.lod.find(({ device }) => device === quality)!.levels[0]!;
const visibleFeatureIds = new Set(lod.featureIds ?? graph.features.map(({ id }) => id));
const visibleFeatures = graph.features.filter(({ id }) => visibleFeatureIds.has(id));
qualityLabel.textContent = quality === "mobile" ? "移动质量" : "桌面质量";
metricsLabel.textContent = `${visibleFeatures.length} 个绘制单元 · 三角形预算 ${lod.triangleBudget!.toLocaleString("zh-CN")}`;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#EEF2F5");
scene.fog = new THREE.Fog("#EEF2F5", 3_800, 6_500);

const preview = definition.manifest.previews.find(({ device }) => device === quality)!;
const camera = new THREE.PerspectiveCamera(40, 1, 1, 10_000);
camera.position.set(...preview.cameraPosition);

const renderer = new THREE.WebGLRenderer({ antialias: quality === "desktop", alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "desktop" ? 2 : 1.5));
previewContainer.append(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(...preview.cameraTarget);
controls.minDistance = 1_200;
controls.maxDistance = 5_000;
controls.maxPolarAngle = Math.PI * 0.49;

const hemisphere = new THREE.HemisphereLight("#EAF6FF", "#45515A", 2.2);
scene.add(hemisphere);
const keyLight = new THREE.DirectionalLight("#FFFFFF", 3.8);
keyLight.position.set(1_400, 2_200, 1_700);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1_024, 1_024);
keyLight.shadow.camera.left = -1_200;
keyLight.shadow.camera.right = 1_200;
keyLight.shadow.camera.top = 2_200;
keyLight.shadow.camera.bottom = -500;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight("#73BDF8", 1.4);
rimLight.position.set(-1_500, 1_200, -1_100);
scene.add(rimLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(4_600, 4_600),
  new THREE.MeshStandardMaterial({ color: "#D8E0E5", roughness: 0.92, metalness: 0 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(4_600, 18, "#97A8B2", "#C4CED4");
grid.position.y = 1;
scene.add(grid);

const materialProperties = {
  default: { roughness: 0.52, metalness: 0.05 },
  wood: { roughness: 0.68, metalness: 0 },
  metal: { roughness: 0.24, metalness: 0.78 },
  plastic: { roughness: 0.42, metalness: 0.04 },
  glass: { roughness: 0.08, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false },
  fabric: { roughness: 0.9, metalness: 0 },
  rubber: { roughness: 0.86, metalness: 0 },
} as const;

function createMaterial(feature: ModelFeature): THREE.MeshStandardMaterial {
  const preset = feature.appearance?.material ?? "default";
  const material = new THREE.MeshStandardMaterial({
    color: feature.appearance?.color ?? "#B7C3CA",
    ...materialProperties[preset],
  });
  if (["power-indicator", "heating-indicator", "cooling-indicator"].includes(feature.id)) {
    material.emissive.set(feature.appearance?.color ?? "#FFFFFF");
    material.emissiveIntensity = 1.8;
  }
  return material;
}

function createFeatureMesh(feature: ModelFeature): THREE.Mesh | null {
  const radialSegments = quality === "desktop" ? 28 : 12;
  const geometry = feature.type === "box"
    ? new THREE.BoxGeometry(feature.parameters.width, feature.parameters.height, feature.parameters.depth)
    : feature.type === "cylinder"
      ? new THREE.CylinderGeometry(feature.parameters.radius, feature.parameters.radius, feature.parameters.height, radialSegments)
      : null;
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, createMaterial(feature));
  mesh.name = feature.id;
  mesh.position.set(...feature.position);
  mesh.rotation.set(...feature.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]);
  if (feature.scale) mesh.scale.set(...feature.scale);
  mesh.castShadow = feature.appearance?.material !== "glass";
  mesh.receiveShadow = true;
  return mesh;
}

function applyPreviewPose(mesh: THREE.Mesh, featureId: string): void {
  const group = graph.groups?.find(({ featureIds }) => featureIds.includes(featureId));
  const joint = graph.joints?.find(({ groupId }) => groupId === group?.id);
  if (!joint) return;
  const value = previewPose?.jointValues[joint.id] ?? joint.value;
  if (value === 0) return;

  const pivot = new THREE.Vector3(...joint.pivot);
  const axis = new THREE.Vector3(...joint.axis).normalize();
  const angle = THREE.MathUtils.degToRad(value);
  mesh.position.sub(pivot).applyAxisAngle(axis, angle).add(pivot);
  mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
}

const modelGroup = new THREE.Group();
for (const feature of visibleFeatures) {
  const mesh = createFeatureMesh(feature);
  if (mesh) {
    applyPreviewPose(mesh, feature.id);
    modelGroup.add(mesh);
  }
}
scene.add(modelGroup);

const fillTarget = definition.manifest.anchors.find(({ id }) => id === "water-fill-target");
const actorApproach = definition.manifest.anchors.find(({ id }) => id === "water-fill-approach");
if (fillTarget && actorApproach) {
  const actorRing = new THREE.Mesh(
    new THREE.RingGeometry(105, 132, 36),
    new THREE.MeshBasicMaterial({ color: "#23A978", side: THREE.DoubleSide, transparent: true, opacity: 0.84 }),
  );
  actorRing.rotation.x = -Math.PI / 2;
  actorRing.position.set(...actorApproach.position);
  actorRing.position.y = 4;
  scene.add(actorRing);

  const targetMarker = new THREE.Mesh(
    new THREE.SphereGeometry(20, quality === "desktop" ? 20 : 10, quality === "desktop" ? 14 : 8),
    new THREE.MeshBasicMaterial({ color: "#1BC9A0" }),
  );
  targetMarker.position.set(...fillTarget.position);
  scene.add(targetMarker);

  const path = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...actorApproach.position).setY(8),
      new THREE.Vector3(...fillTarget.position),
    ]),
    new THREE.LineDashedMaterial({ color: "#23A978", dashSize: 42, gapSize: 26 }),
  );
  path.computeLineDistances();
  scene.add(path);
}

function resize(): void {
  const width = previewContainer.clientWidth;
  const height = previewContainer.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function render(): void {
  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(render);
}

window.addEventListener("resize", resize);
resize();
render();
