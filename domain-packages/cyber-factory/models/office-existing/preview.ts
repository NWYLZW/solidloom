import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type {
  ModelAssetAnchor,
  ModelAssetCollider,
  ModelAssetDeviceClass,
  ModelFeature,
  Vector3Tuple,
} from "@solidloom/shared";
import {
  officeAssetDefinitionByKey,
  officeAssetPerformanceBudgets,
  type OfficeExistingAssetKey,
} from "./index.js";

type DevicePreference = ModelAssetDeviceClass | "auto";

const assetKeys = ["desk", "chair", "laptop", "monitor", "tower", "avatar"] as const;
const assetLabels: Record<OfficeExistingAssetKey, string> = {
  desk: "办公桌",
  chair: "人体工学椅",
  laptop: "笔记本",
  monitor: "显示器",
  tower: "主机箱",
  avatar: "方块角色",
};

function requiredElement<T extends HTMLElement = HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`缺少预览元素：${id}`);
  return element as T;
}

function isAssetKey(value: string | null): value is OfficeExistingAssetKey {
  return assetKeys.includes(value as OfficeExistingAssetKey);
}

function isDevicePreference(value: string | null): value is DevicePreference {
  return value === "auto" || value === "desktop" || value === "mobile";
}

const params = new URLSearchParams(window.location.search);
const requestedAsset = params.get("asset");
const requestedDevice = params.get("device");
let assetKey: OfficeExistingAssetKey = isAssetKey(requestedAsset) ? requestedAsset : "desk";
let devicePreference: DevicePreference = isDevicePreference(requestedDevice) ? requestedDevice : "auto";
let showAnchors = true;
let showColliders = true;
let showScale = assetKey === "desk" || assetKey === "chair";

const root = requiredElement("preview-root");
const canvas = requiredElement<HTMLCanvasElement>("preview-canvas");
const assetSelect = requiredElement<HTMLSelectElement>("asset-select");
const deviceSelect = requiredElement<HTMLSelectElement>("device-select");
const anchorsToggle = requiredElement<HTMLButtonElement>("anchors-toggle");
const collidersToggle = requiredElement<HTMLButtonElement>("colliders-toggle");
const scaleToggle = requiredElement<HTMLButtonElement>("scale-toggle");

assetSelect.value = assetKey;
deviceSelect.value = devicePreference;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b171b, 0.00014);

const camera = new THREE.PerspectiveCamera(34, 1, 1, 50_000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 160;
controls.maxDistance = 14_000;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xc9f7ef, 0x1a2528, 1.7));
const keyLight = new THREE.DirectionalLight(0xfff1d5, 4.1);
keyLight.position.set(2_800, 4_200, 3_500);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2_048, 2_048);
keyLight.shadow.camera.left = -3_500;
keyLight.shadow.camera.right = 3_500;
keyLight.shadow.camera.top = 3_500;
keyLight.shadow.camera.bottom = -3_500;
keyLight.shadow.camera.near = 100;
keyLight.shadow.camera.far = 12_000;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x65dfca, 2.2);
rimLight.position.set(-2_800, 2_200, -2_600);
scene.add(rimLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(18_000, 18_000),
  new THREE.MeshStandardMaterial({ color: 0x132126, roughness: 0.92, metalness: 0.02 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(18_000, 180, 0x416d68, 0x25433f);
grid.position.y = 0.6;
grid.material.transparent = true;
grid.material.opacity = 0.42;
scene.add(grid);

let modelRoot = new THREE.Group();
let anchorRoot = new THREE.Group();
let colliderRoot = new THREE.Group();
let scaleRoot = new THREE.Group();
scene.add(modelRoot, anchorRoot, colliderRoot, scaleRoot);

function disposeObject(rootObject: THREE.Object3D) {
  rootObject.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.LineSegments)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
  rootObject.removeFromParent();
}

function geometryFor(feature: ModelFeature) {
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
      24,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(feature.parameters.positions), 3),
  );
  if (feature.parameters.normals.length > 0) {
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(feature.parameters.normals), 3),
    );
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setIndex(feature.parameters.indices);
  return geometry;
}

function materialFor(feature: ModelFeature) {
  const preset = feature.appearance?.material ?? "default";
  const color = feature.appearance?.color ?? "#AAB8B6";
  const isGlass = preset === "glass";
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: preset === "fabric" ? 0.9 : preset === "wood" ? 0.58 : preset === "metal" ? 0.24 : 0.48,
    metalness: preset === "metal" ? 0.78 : 0.02,
    clearcoat: preset === "plastic" ? 0.16 : 0,
    clearcoatRoughness: 0.45,
    transparent: isGlass,
    opacity: isGlass ? 0.64 : 1,
    transmission: isGlass ? 0.16 : 0,
    depthWrite: !isGlass,
  });
}

function applyTransform(object: THREE.Object3D, position: Vector3Tuple, rotation: Vector3Tuple) {
  object.position.set(...position);
  object.rotation.set(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2]),
  );
}

function createAnchorMarker(anchor: ModelAssetAnchor, size: number) {
  const marker = new THREE.Group();
  const color = anchor.kind === "seat"
    ? 0x87a8ff
    : anchor.kind === "placement" || anchor.kind === "socket"
      ? 0x66dfc9
      : anchor.kind === "approach"
        ? 0xf0b86a
        : 0xe56fe0;
  const material = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    opacity: 0.95,
    transparent: true,
    toneMapped: false,
  });
  const point = new THREE.Mesh(new THREE.SphereGeometry(size * 0.34, 14, 10), material);
  marker.add(point);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(size, size * 0.08, 8, 30),
    material.clone(),
  );
  ring.rotation.x = Math.PI / 2;
  marker.add(ring);
  const direction = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.22, size * 0.7, 10),
    material.clone(),
  );
  direction.rotation.x = Math.PI / 2;
  direction.position.z = size * 1.1;
  marker.add(direction);
  applyTransform(marker, anchor.position, anchor.rotation);
  marker.renderOrder = 20;
  marker.userData.anchorId = anchor.id;
  return marker;
}

function colliderGeometry(collider: ModelAssetCollider) {
  if (collider.shape === "box") return new THREE.BoxGeometry(...collider.size);
  if (collider.shape === "cylinder") {
    return new THREE.CylinderGeometry(collider.radius!, collider.radius!, collider.height!, 20);
  }
  const straightLength = Math.max(1, collider.height!);
  return new THREE.CapsuleGeometry(collider.radius!, straightLength, 8, 16);
}

function createColliderMarker(collider: ModelAssetCollider) {
  const material = new THREE.MeshBasicMaterial({
    color: collider.dynamic ? 0xf0856a : 0xf0b86a,
    opacity: 0.23,
    transparent: true,
    wireframe: true,
    depthTest: true,
    toneMapped: false,
  });
  const marker = new THREE.Mesh(colliderGeometry(collider), material);
  marker.name = collider.id;
  applyTransform(marker, collider.position, collider.rotation);
  return marker;
}

function createScaleAvatar() {
  const definition = officeAssetDefinitionByKey.avatar;
  const rootObject = new THREE.Group();
  for (const feature of definition.createModel().featureGraph!.features) {
    const mesh = new THREE.Mesh(
      geometryFor(feature),
      new THREE.MeshStandardMaterial({
        color: 0xd8b46f,
        opacity: 0.25,
        roughness: 0.72,
        transparent: true,
        depthWrite: false,
      }),
    );
    applyTransform(mesh, feature.position, feature.rotation);
    rootObject.add(mesh);
  }
  const heightLineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-520, 0, 0),
    new THREE.Vector3(-520, 1_720, 0),
  ]);
  rootObject.add(new THREE.Line(
    heightLineGeometry,
    new THREE.LineBasicMaterial({ color: 0xf0b86a, transparent: true, opacity: 0.72 }),
  ));
  return rootObject;
}

function resolvedDevice(): ModelAssetDeviceClass {
  if (devicePreference !== "auto") return devicePreference;
  return window.innerWidth <= 640 ? "mobile" : "desktop";
}

function updateUrl() {
  const next = new URL(window.location.href);
  next.searchParams.set("asset", assetKey);
  next.searchParams.set("device", devicePreference);
  window.history.replaceState(null, "", next);
}

function resetToggle(button: HTMLButtonElement, pressed: boolean) {
  button.setAttribute("aria-pressed", String(pressed));
}

function rebuild() {
  disposeObject(modelRoot);
  disposeObject(anchorRoot);
  disposeObject(colliderRoot);
  disposeObject(scaleRoot);
  modelRoot = new THREE.Group();
  anchorRoot = new THREE.Group();
  colliderRoot = new THREE.Group();
  scaleRoot = new THREE.Group();
  scene.add(modelRoot, anchorRoot, colliderRoot, scaleRoot);

  const definition = officeAssetDefinitionByKey[assetKey];
  const device = resolvedDevice();
  const profile = definition.manifest.lod.find((candidate) => candidate.device === device)!;
  const level = profile.levels[0]!;
  const visibleIds = new Set(level.featureIds);
  let triangleCount = 0;
  const graph = definition.createModel().featureGraph!;

  for (const feature of graph.features) {
    if (!visibleIds.has(feature.id)) continue;
    const geometry = geometryFor(feature);
    triangleCount += geometry.index
      ? geometry.index.count / 3
      : geometry.getAttribute("position").count / 3;
    const mesh = new THREE.Mesh(geometry, materialFor(feature));
    mesh.name = feature.id;
    applyTransform(mesh, feature.position, feature.rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    modelRoot.add(mesh);
  }

  const bounds = new THREE.Box3().setFromObject(modelRoot);
  const boundsSize = bounds.getSize(new THREE.Vector3());
  const markerSize = THREE.MathUtils.clamp(Math.max(boundsSize.x, boundsSize.y, boundsSize.z) * 0.018, 12, 42);
  definition.manifest.anchors.forEach((anchor) => anchorRoot.add(createAnchorMarker(anchor, markerSize)));
  definition.manifest.colliders.forEach((collider) => colliderRoot.add(createColliderMarker(collider)));
  anchorRoot.visible = showAnchors;
  colliderRoot.visible = showColliders;

  scaleRoot.add(createScaleAvatar());
  const scaleOffsets: Record<OfficeExistingAssetKey, Vector3Tuple> = {
    desk: [-1_200, 0, 160],
    chair: [-760, 0, 80],
    laptop: [-650, 0, 0],
    monitor: [-820, 0, 0],
    tower: [-620, 0, 0],
    avatar: [-900, 0, 0],
  };
  scaleRoot.position.set(...scaleOffsets[assetKey]);
  scaleRoot.visible = showScale && assetKey !== "avatar";

  const preview = definition.manifest.previews.find((candidate) => candidate.device === device)!;
  camera.position.set(...preview.cameraPosition);
  controls.target.set(...preview.cameraTarget);
  camera.fov = device === "mobile" ? 38 : 34;
  camera.updateProjectionMatrix();
  controls.update();

  const budget = officeAssetPerformanceBudgets[assetKey][device][0]!;
  requiredElement("asset-name").textContent = assetLabels[assetKey];
  requiredElement("asset-description").textContent = definition.manifest.description;
  requiredElement("asset-id-badge").textContent = definition.manifest.id;
  requiredElement("device-badge").textContent = device === "mobile" ? "手机层级" : "桌面层级";
  requiredElement("anchor-badge").textContent = `${definition.manifest.anchors.length} 个锚点`;
  requiredElement("lod-metric").textContent = level.id;
  requiredElement("draw-call-metric").textContent = `${visibleIds.size} / ${budget.maximumDrawCalls}`;
  requiredElement("triangle-metric").textContent = `${Math.round(triangleCount).toLocaleString("zh-CN")} / ${budget.triangleBudget.toLocaleString("zh-CN")}`;
  resetToggle(anchorsToggle, showAnchors);
  resetToggle(collidersToggle, showColliders);
  resetToggle(scaleToggle, showScale && assetKey !== "avatar");
  scaleToggle.disabled = assetKey === "avatar";
  document.title = `${assetLabels[assetKey]} · ${device === "mobile" ? "手机" : "桌面"}独立预览`;
}

assetSelect.addEventListener("change", () => {
  assetKey = assetSelect.value as OfficeExistingAssetKey;
  showScale = assetKey === "desk" || assetKey === "chair";
  updateUrl();
  rebuild();
});
deviceSelect.addEventListener("change", () => {
  devicePreference = deviceSelect.value as DevicePreference;
  updateUrl();
  rebuild();
});
anchorsToggle.addEventListener("click", () => {
  showAnchors = !showAnchors;
  anchorRoot.visible = showAnchors;
  resetToggle(anchorsToggle, showAnchors);
});
collidersToggle.addEventListener("click", () => {
  showColliders = !showColliders;
  colliderRoot.visible = showColliders;
  resetToggle(collidersToggle, showColliders);
});
scaleToggle.addEventListener("click", () => {
  if (assetKey === "avatar") return;
  showScale = !showScale;
  scaleRoot.visible = showScale;
  resetToggle(scaleToggle, showScale);
});

function resize() {
  const width = root.clientWidth;
  const height = root.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  if (devicePreference === "auto") rebuild();
}

renderer.setAnimationLoop((time) => {
  controls.update();
  anchorRoot.children.forEach((marker, index) => {
    marker.scale.setScalar(1 + Math.sin(time * 0.002 + index) * 0.08);
  });
  renderer.render(scene, camera);
});

window.addEventListener("resize", resize);
rebuild();
resize();
