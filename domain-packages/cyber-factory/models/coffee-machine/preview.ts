import type { ModelAssetDeviceClass, ModelFeature } from "@solidloom/shared";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { coffeeMachineManifest } from "./manifest.js";
import {
  coffeeMachineFeatureIds,
  coffeeMachineJointIds,
  createCoffeeMachine,
  defaultCoffeeMachineParameters,
  type CoffeeMachineFinish,
  type CoffeeMachineParameters,
} from "./model.js";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`缺少预览元素：${id}`);
  return element as T;
}

const canvas = requiredElement<HTMLCanvasElement>("preview-canvas");
const root = requiredElement<HTMLElement>("preview-root");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1114, 0.00042);
const camera = new THREE.PerspectiveCamera(34, 1, 1, 10000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 650;
controls.maxDistance = 2800;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xb9f4ec, 0x152027, 1.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
keyLight.position.set(780, 1100, 920);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -900;
keyLight.shadow.camera.right = 900;
keyLight.shadow.camera.top = 900;
keyLight.shadow.camera.bottom = -900;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x5adcca, 2.4);
rimLight.position.set(-900, 620, -700);
scene.add(rimLight);

const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x111b20, roughness: 0.9, metalness: 0.08 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(1500, 80), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(3000, 30, 0x365b5b, 0x1c3235);
grid.position.y = 0.5;
scene.add(grid);

let modelRoot = new THREE.Group();
scene.add(modelRoot);
let lidPivot: THREE.Group | null = null;
let lidOpen = false;
let devicePreference: "auto" | ModelAssetDeviceClass = "auto";
let cameraDevice: ModelAssetDeviceClass | null = null;
let parameters: CoffeeMachineParameters = { ...defaultCoffeeMachineParameters };

function materialFor(feature: ModelFeature) {
  const color = feature.appearance?.color ?? "#AAB4B9";
  const preset = feature.appearance?.material ?? "default";
  const isGlass = preset === "glass";
  const isMetal = preset === "metal";
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: isMetal ? 0.28 : preset === "rubber" ? 0.78 : 0.46,
    metalness: isMetal ? 0.84 : 0.06,
    transparent: isGlass,
    opacity: isGlass ? 0.48 : 1,
    transmission: isGlass ? 0.24 : 0,
    depthWrite: !isGlass,
  });
  if (feature.id === coffeeMachineFeatureIds.display) {
    material.emissive = new THREE.Color("#1D7183");
    material.emissiveIntensity = 1.25;
  }
  if (feature.id === coffeeMachineFeatureIds.statusLight) {
    material.emissive = new THREE.Color(color);
    material.emissiveIntensity = 2.8;
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
    return new THREE.CylinderGeometry(feature.parameters.radius, feature.parameters.radius, feature.parameters.height, 32);
  }
  const positions = new Float32Array(feature.parameters.positions);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (feature.parameters.normals.length > 0) {
    geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(feature.parameters.normals), 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setIndex(feature.parameters.indices);
  return geometry;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Line)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
  object.removeFromParent();
}

function resolvedDevice(): ModelAssetDeviceClass {
  if (devicePreference !== "auto") return devicePreference;
  return window.innerWidth <= 640 ? "mobile" : "desktop";
}

function createAnchorMarker(
  id: "brew-coffee" | "cup-socket" | "take-cup",
  color: number,
  radius: number,
) {
  const anchor = coffeeMachineManifest.anchors.find((candidate) => candidate.id === id)!;
  const marker = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 5, 10, 36), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(anchor.position[0], id === "cup-socket" ? anchor.position[1] : 5, anchor.position[2]);
  marker.add(ring);
  if (id !== "cup-socket") {
    const point = new THREE.Mesh(
      new THREE.SphereGeometry(12, 18, 12),
      new THREE.MeshBasicMaterial({ color }),
    );
    point.position.set(...anchor.position);
    marker.add(point);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(anchor.position[0], 5, anchor.position[2]),
      new THREE.Vector3(...anchor.position),
    ]);
    marker.add(new THREE.Line(lineGeometry, new THREE.LineDashedMaterial({ color, dashSize: 18, gapSize: 12 })));
  }
  marker.userData.anchorId = id;
  return marker;
}

function rebuildModel() {
  disposeObject(modelRoot);
  modelRoot = new THREE.Group();
  scene.add(modelRoot);
  lidPivot = null;

  const model = createCoffeeMachine(parameters);
  const graph = model.featureGraph!;
  const device = resolvedDevice();
  if (cameraDevice !== device) {
    const preview = coffeeMachineManifest.previews.find((candidate) => candidate.device === device)!;
    camera.position.set(...preview.cameraPosition);
    controls.target.set(...preview.cameraTarget);
    camera.fov = device === "mobile" ? 38 : 34;
    camera.updateProjectionMatrix();
    controls.update();
    cameraDevice = device;
  }
  const profile = coffeeMachineManifest.lod.find((candidate) => candidate.device === device)!;
  const visibleIds = new Set(profile.levels[0]!.featureIds);
  const meshes = new Map<string, THREE.Mesh>();

  graph.features.forEach((feature) => {
    if (!visibleIds.has(feature.id)) return;
    const mesh = new THREE.Mesh(geometryFor(feature), materialFor(feature));
    mesh.name = feature.name;
    mesh.position.set(...feature.position);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(feature.rotation[0]),
      THREE.MathUtils.degToRad(feature.rotation[1]),
      THREE.MathUtils.degToRad(feature.rotation[2]),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    modelRoot.add(mesh);
    meshes.set(feature.id, mesh);
  });

  const lidMesh = meshes.get(coffeeMachineFeatureIds.waterTankLid);
  const lidJoint = graph.joints?.find((joint) => joint.id === coffeeMachineJointIds.waterTankLid);
  if (lidMesh && lidJoint) {
    lidPivot = new THREE.Group();
    lidPivot.position.set(...lidJoint.pivot);
    modelRoot.add(lidPivot);
    lidMesh.position.sub(lidPivot.position);
    lidPivot.add(lidMesh);
    lidPivot.rotation.x = THREE.MathUtils.degToRad(lidOpen ? -72 : 0);
  }

  modelRoot.add(createAnchorMarker("brew-coffee", 0x58d7c5, 38));
  modelRoot.add(createAnchorMarker("take-cup", 0xf1ae62, 32));
  modelRoot.add(createAnchorMarker("cup-socket", 0x88aef0, 48));

  requiredElement("device-badge").textContent = device === "mobile" ? "手机简化层级" : "桌面完整层级";
  requiredElement("dimension-badge").textContent = `${parameters.width} × ${parameters.height} × ${parameters.depth} mm`;
}

function updateParameter(id: "depth" | "height" | "width") {
  const input = requiredElement<HTMLInputElement>(id);
  parameters = { ...parameters, [id]: Number(input.value) };
  requiredElement(`${id}-output`).textContent = `${input.value} mm`;
  rebuildModel();
}

(["width", "height", "depth"] as const).forEach((id) => {
  requiredElement<HTMLInputElement>(id).addEventListener("input", () => updateParameter(id));
});
requiredElement<HTMLSelectElement>("finish").addEventListener("change", (event) => {
  parameters = { ...parameters, finish: (event.currentTarget as HTMLSelectElement).value as CoffeeMachineFinish };
  rebuildModel();
});
requiredElement<HTMLSelectElement>("device").addEventListener("change", (event) => {
  devicePreference = (event.currentTarget as HTMLSelectElement).value as typeof devicePreference;
  rebuildModel();
});
requiredElement<HTMLButtonElement>("lid-toggle").addEventListener("click", (event) => {
  lidOpen = !lidOpen;
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute("aria-pressed", String(lidOpen));
  button.textContent = lidOpen ? "关闭水箱翻盖" : "打开水箱翻盖";
});

function resize() {
  const width = root.clientWidth;
  const height = root.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  if (devicePreference === "auto") rebuildModel();
}

let previousTime = 0;
renderer.setAnimationLoop((time) => {
  controls.update();
  if (lidPivot) {
    const target = THREE.MathUtils.degToRad(lidOpen ? -72 : 0);
    lidPivot.rotation.x = THREE.MathUtils.damp(lidPivot.rotation.x, target, 8, (time - previousTime) / 1000);
  }
  previousTime = time;
  renderer.render(scene, camera);
});

window.addEventListener("resize", resize);
rebuildModel();
resize();
