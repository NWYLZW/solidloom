import type {
  ArticulationJoint,
  ModelAssetAnchor,
  ModelAssetCollider,
  ModelAssetDefinition,
  ModelAssetDeviceClass,
  ModelFeature,
  Vector3Tuple,
} from "@solidloom/shared";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  createRestroomMirrorDefinition,
  createRestroomPartitionDefinition,
  createRestroomStallDoorDefinition,
  createRestroomToiletDefinition,
  createRestroomUrinalBankDefinition,
  createRestroomVanityDefinition,
} from "./asset.js";
import { restroomDoorLeafBounds } from "./model.js";
import { createRestroomPreviewFixtureLayout } from "./preview-layout.js";

type DevicePreference = "auto" | ModelAssetDeviceClass;

interface PreviewState {
  anchorVisible: boolean;
  colliderVisible: boolean;
  device: DevicePreference;
  dividerEnabled: boolean;
  doorOpen: boolean;
  urinalCount: number;
  urinalSpacing: number;
}

interface AssetTransform {
  position: Vector3Tuple;
  rotationY?: number;
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`缺少厕所资产预览元素：${id}`);
  return element as T;
}

const canvas = requiredElement<HTMLCanvasElement>("preview-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x071013, 0.000035);

const camera = new THREE.PerspectiveCamera(43, 1, 10, 60_000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 3_200;
controls.maxDistance = 25_000;
controls.maxPolarAngle = Math.PI * 0.48;

scene.add(new THREE.HemisphereLight(0xd9fff8, 0x223235, 2.75));
const keyLight = new THREE.DirectionalLight(0xfff1d4, 4.2);
keyLight.position.set(3_600, 6_200, 4_800);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2_048, 2_048);
keyLight.shadow.camera.left = -7_000;
keyLight.shadow.camera.right = 7_000;
keyLight.shadow.camera.top = 7_000;
keyLight.shadow.camera.bottom = -7_000;
scene.add(keyLight);
const frontLight = new THREE.DirectionalLight(0xd8fff7, 2.4);
frontLight.position.set(800, 2_800, 5_000);
scene.add(frontLight);
const fillLight = new THREE.PointLight(0x65e0d0, 1_500, 11_000, 1.4);
fillLight.position.set(-2_600, 2_300, 2_600);
scene.add(fillLight);
const vanityLight = new THREE.PointLight(0xf0c07a, 1_200, 7_000, 1.5);
vanityLight.position.set(3_400, 2_400, -300);
scene.add(vanityLight);

const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x203033, roughness: 0.86, metalness: 0.04 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(9_500, 7_200), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.set(100, 0, -250);
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(9_500, 38, 0x3b6964, 0x294845);
grid.position.set(100, 2, -250);
scene.add(grid);

const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x46615f, roughness: 0.93, metalness: 0.02 });
const backWall = new THREE.Mesh(new THREE.BoxGeometry(6_300, 2_650, 70), wallMaterial);
backWall.position.set(200, 1_325, -1_870);
backWall.receiveShadow = true;
scene.add(backWall);
const fixtureLayout = createRestroomPreviewFixtureLayout();
const sideWall = new THREE.Mesh(new THREE.BoxGeometry(...fixtureLayout.sideWall.size), wallMaterial);
sideWall.position.set(...fixtureLayout.sideWall.position);
sideWall.receiveShadow = true;
scene.add(sideWall);

const state: PreviewState = {
  anchorVisible: false,
  colliderVisible: false,
  device: "auto",
  dividerEnabled: true,
  doorOpen: true,
  urinalCount: 3,
  urinalSpacing: 700,
};

let assetRoot = new THREE.Group();
let anchorRoot = new THREE.Group();
let colliderRoot = new THREE.Group();
scene.add(assetRoot, anchorRoot, colliderRoot);

function resolvedDevice(): ModelAssetDeviceClass {
  if (state.device !== "auto") return state.device;
  return window.innerWidth <= 640 ? "mobile" : "desktop";
}

function materialFor(feature: ModelFeature) {
  const preset = feature.appearance?.material ?? "default";
  const color = feature.appearance?.color ?? "#C4CFCE";
  const isGlass = preset === "glass";
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: preset === "metal" ? 0.24 : preset === "glass" ? 0.08 : preset === "wood" ? 0.58 : preset === "plastic" ? 0.48 : 0.42,
    metalness: preset === "metal" ? 0.78 : 0.03,
    transparent: isGlass,
    opacity: isGlass ? 0.64 : 1,
    transmission: isGlass ? 0.22 : 0,
    depthWrite: !isGlass,
    side: THREE.DoubleSide,
  });
  if (isGlass) {
    material.clearcoat = 1;
    material.clearcoatRoughness = 0.08;
  }
  return material;
}

function geometryFor(feature: ModelFeature) {
  if (feature.type === "box") {
    const { width, height, depth, cornerRadius = 0 } = feature.parameters;
    if (cornerRadius > 0) {
      return new RoundedBoxGeometry(width, height, depth, 4, Math.min(cornerRadius, width / 4, height / 4, depth / 4));
    }
    return new THREE.BoxGeometry(width, height, depth);
  }
  if (feature.type === "cylinder") {
    return new THREE.CylinderGeometry(feature.parameters.radius, feature.parameters.radius, feature.parameters.height, 36);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(feature.parameters.positions), 3));
  if (feature.parameters.normals.length > 0) {
    geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(feature.parameters.normals), 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setIndex(feature.parameters.indices);
  return geometry;
}

function setDegrees(object: THREE.Object3D, rotation: Vector3Tuple) {
  object.rotation.set(...rotation.map(THREE.MathUtils.degToRad) as Vector3Tuple);
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.LineSegments)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
  object.removeFromParent();
}

function markerColor(anchor: ModelAssetAnchor) {
  if (anchor.tags?.includes("maintenance")) return 0xf1bd70;
  if (anchor.kind === "approach") return 0x79a8ff;
  return 0x63e3cf;
}

function createAnchorMarker(anchor: ModelAssetAnchor) {
  const root = new THREE.Group();
  const color = markerColor(anchor);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(anchor.kind === "approach" ? 115 : 82, 10, 10, 42), material);
  ring.rotation.x = Math.PI / 2;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 150, 12), material.clone());
  stem.position.y = 75;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(23, 68, 14), material.clone());
  tip.position.y = 178;
  root.add(ring, stem, tip);
  root.position.set(...anchor.position);
  root.renderOrder = 20;
  return root;
}

function colliderGeometry(collider: ModelAssetCollider) {
  if (collider.shape === "box") return new THREE.BoxGeometry(...collider.size);
  return new THREE.CylinderGeometry(collider.radius!, collider.radius!, collider.height!, 24);
}

function createColliderWire(collider: ModelAssetCollider) {
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(colliderGeometry(collider)),
    new THREE.LineBasicMaterial({ color: collider.dynamic ? 0xffa45f : 0x73d8ce, transparent: true, opacity: 0.7, depthTest: false }),
  );
  wire.position.set(...collider.position);
  setDegrees(wire, collider.rotation);
  wire.renderOrder = 15;
  return wire;
}

function addDefinition(definition: ModelAssetDefinition, transform: AssetTransform) {
  const model = definition.createModel();
  const graph = model.featureGraph!;
  const instance = new THREE.Group();
  instance.position.set(...transform.position);
  instance.rotation.y = THREE.MathUtils.degToRad(transform.rotationY ?? 0);
  assetRoot.add(instance);

  const instanceAnchors = new THREE.Group();
  instanceAnchors.position.copy(instance.position);
  instanceAnchors.rotation.copy(instance.rotation);
  anchorRoot.add(instanceAnchors);
  const instanceColliders = new THREE.Group();
  instanceColliders.position.copy(instance.position);
  instanceColliders.rotation.copy(instance.rotation);
  colliderRoot.add(instanceColliders);

  const joints = graph.joints ?? [];
  const jointFeatureIds = new Map<string, ArticulationJoint>();
  for (const joint of joints) {
    const group = graph.groups?.find(({ id }) => id === joint.groupId);
    group?.featureIds.forEach((id) => jointFeatureIds.set(id, joint));
  }
  const jointObjects = new Map<string, THREE.Group>();
  function jointObject(joint: ArticulationJoint, parent: THREE.Group) {
    const existing = jointObjects.get(`${parent.uuid}:${joint.id}`);
    if (existing) return existing;
    const object = new THREE.Group();
    object.position.set(...joint.pivot);
    if (joint.axis[1] === 1) {
      const value = state.doorOpen ? joint.min : joint.restValue;
      object.rotation.y = THREE.MathUtils.degToRad(value);
    }
    parent.add(object);
    jointObjects.set(`${parent.uuid}:${joint.id}`, object);
    return object;
  }

  const profile = definition.manifest.lod.find(({ device }) => device === resolvedDevice())!;
  const visibleIds = new Set(profile.levels[0]!.featureIds ?? graph.features.map(({ id }) => id));
  for (const feature of graph.features) {
    if (!visibleIds.has(feature.id)) continue;
    const mesh = new THREE.Mesh(geometryFor(feature), materialFor(feature));
    mesh.name = feature.name;
    mesh.position.set(...feature.position);
    setDegrees(mesh, feature.rotation);
    mesh.castShadow = feature.appearance?.material !== "glass";
    mesh.receiveShadow = true;
    const joint = jointFeatureIds.get(feature.id);
    if (joint) {
      const object = jointObject(joint, instance);
      mesh.position.sub(new THREE.Vector3(...joint.pivot));
      object.add(mesh);
    } else {
      instance.add(mesh);
    }
  }

  for (const anchor of definition.manifest.anchors) {
    const marker = createAnchorMarker(anchor);
    const joint = anchor.jointId ? joints.find(({ id }) => id === anchor.jointId) : undefined;
    if (joint) {
      const object = jointObject(joint, instanceAnchors);
      marker.position.sub(new THREE.Vector3(...joint.pivot));
      object.add(marker);
    } else {
      instanceAnchors.add(marker);
    }
  }
  for (const collider of definition.manifest.colliders) {
    const wire = createColliderWire(collider);
    const joint = collider.jointId ? joints.find(({ id }) => id === collider.jointId) : undefined;
    if (joint) {
      const object = jointObject(joint, instanceColliders);
      wire.position.sub(new THREE.Vector3(...joint.pivot));
      object.add(wire);
    } else {
      instanceColliders.add(wire);
    }
  }
}

function addLabel(text: string, position: Vector3Tuple) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 96;
  const context = labelCanvas.getContext("2d")!;
  context.fillStyle = "rgba(8, 18, 21, 0.82)";
  context.roundRect(4, 4, 504, 88, 20);
  context.fill();
  context.strokeStyle = "rgba(99, 227, 207, 0.6)";
  context.lineWidth = 3;
  context.stroke();
  context.font = "600 32px PingFang SC, sans-serif";
  context.fillStyle = "#EAF7F4";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 50);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.set(...position);
  sprite.scale.set(1_050, 197, 1);
  sprite.renderOrder = 30;
  assetRoot.add(sprite);
}

function rebuildScene() {
  disposeObject(assetRoot);
  disposeObject(anchorRoot);
  disposeObject(colliderRoot);
  assetRoot = new THREE.Group();
  anchorRoot = new THREE.Group();
  colliderRoot = new THREE.Group();
  scene.add(assetRoot, anchorRoot, colliderRoot);

  const partition = createRestroomPartitionDefinition({ width: 1_800 });
  [-2_320, -1_370, -420].forEach((x) => addDefinition(partition, { position: [x, 0, -920], rotationY: 90 }));

  const door = createRestroomStallDoorDefinition({ openingWidth: 900, openAngle: 88 });
  addDefinition(door, { position: [-1_845, 0, -20] });
  addDefinition(door, { position: [-895, 0, -20] });

  const toilet = createRestroomToiletDefinition();
  addDefinition(toilet, { position: [-1_845, 0, -1_120] });
  addDefinition(toilet, { position: [-895, 0, -1_120] });
  addDefinition(toilet, { position: [-2_750, 0, 520], rotationY: 12 });

  const urinals = createRestroomUrinalBankDefinition({
    count: state.urinalCount,
    centerSpacing: state.urinalSpacing,
    dividerEnabled: state.dividerEnabled,
  });
  addDefinition(urinals, { position: [650, 0, -1_820] });

  const vanity = createRestroomVanityDefinition({
    width: fixtureLayout.vanity.width,
    depth: fixtureLayout.vanity.depth,
    basinCount: 2,
    basinSpacing: 700,
  });
  addDefinition(vanity, {
    position: fixtureLayout.vanity.position,
    rotationY: fixtureLayout.vanity.rotationY,
  });
  const mirror = createRestroomMirrorDefinition({
    width: fixtureLayout.mirror.width,
    bottomHeight: 1_050,
  });
  addDefinition(mirror, {
    position: fixtureLayout.mirror.position,
    rotationY: fixtureLayout.mirror.rotationY,
  });

  addLabel("双隔间 · 坐便器", [-1_370, 2_380, -700]);
  addLabel("独立坐便器组件", [-2_750, 1_180, 520]);
  addLabel("壁挂小便器 · 可选挡板", [650, 2_000, -1_680]);
  addLabel("洗手台 · 镜面", [3_030, 2_300, -360]);

  anchorRoot.visible = state.anchorVisible;
  colliderRoot.visible = state.colliderVisible;
  updateInterface();
}

function setCamera(force = false) {
  const mobile = resolvedDevice() === "mobile";
  const target = new THREE.Vector3(-100, 850, -720);
  if (force || camera.position.lengthSq() === 0) {
    camera.position.set(...(mobile ? [12_000, 7_000, 17_000] as Vector3Tuple : [4_200, 3_150, 7_300] as Vector3Tuple));
    controls.target.copy(target);
    controls.update();
  }
}

function updateInterface() {
  const device = resolvedDevice();
  requiredElement("device-badge").textContent = device === "mobile" ? "手机精简层级" : "桌面完整层级";
  requiredElement<HTMLOutputElement>("urinal-count-output").value = `${state.urinalCount} 个`;
  requiredElement<HTMLOutputElement>("urinal-spacing-output").value = `${state.urinalSpacing} mm`;
  requiredElement("spacing-metric").textContent = `器具净距 ${state.urinalSpacing - 380} mm`;
  const bounds = restroomDoorLeafBounds({ openingWidth: 900, openAngle: 88 }, -88);
  requiredElement("door-metric").textContent = `开门后净宽 ${Math.round(450 - bounds.maximumX)} mm`;
  const doorButton = requiredElement<HTMLButtonElement>("door-toggle");
  doorButton.textContent = state.doorOpen ? "关闭隔间门" : "打开隔间门";
  doorButton.setAttribute("aria-pressed", String(state.doorOpen));
  const anchorButton = requiredElement<HTMLButtonElement>("anchor-toggle");
  anchorButton.textContent = state.anchorVisible ? "隐藏锚点" : "显示锚点";
  anchorButton.setAttribute("aria-pressed", String(state.anchorVisible));
  const colliderButton = requiredElement<HTMLButtonElement>("collider-toggle");
  colliderButton.textContent = state.colliderVisible ? "隐藏碰撞体" : "显示碰撞体";
  colliderButton.setAttribute("aria-pressed", String(state.colliderVisible));
}

const urinalCountInput = requiredElement<HTMLInputElement>("urinal-count");
urinalCountInput.addEventListener("input", () => {
  state.urinalCount = Number(urinalCountInput.value);
  rebuildScene();
});
const urinalSpacingInput = requiredElement<HTMLInputElement>("urinal-spacing");
urinalSpacingInput.addEventListener("input", () => {
  state.urinalSpacing = Number(urinalSpacingInput.value);
  rebuildScene();
});
requiredElement<HTMLSelectElement>("device").addEventListener("change", (event) => {
  state.device = (event.currentTarget as HTMLSelectElement).value as DevicePreference;
  rebuildScene();
  setCamera(true);
});
requiredElement<HTMLSelectElement>("divider-enabled").addEventListener("change", (event) => {
  state.dividerEnabled = (event.currentTarget as HTMLSelectElement).value === "true";
  rebuildScene();
});
requiredElement<HTMLButtonElement>("door-toggle").addEventListener("click", () => {
  state.doorOpen = !state.doorOpen;
  rebuildScene();
});
requiredElement<HTMLButtonElement>("anchor-toggle").addEventListener("click", () => {
  state.anchorVisible = !state.anchorVisible;
  anchorRoot.visible = state.anchorVisible;
  updateInterface();
});
requiredElement<HTMLButtonElement>("collider-toggle").addEventListener("click", () => {
  state.colliderVisible = !state.colliderVisible;
  colliderRoot.visible = state.colliderVisible;
  updateInterface();
});

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}

let previousAutoDevice = resolvedDevice();
window.addEventListener("resize", () => {
  const nextDevice = resolvedDevice();
  if (state.device === "auto" && previousAutoDevice !== nextDevice) {
    previousAutoDevice = nextDevice;
    rebuildScene();
    setCamera(true);
  }
});

rebuildScene();
setCamera(true);

function render() {
  resize();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();
