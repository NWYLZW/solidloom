import type { ModelAssetDeviceClass, ModelFeature, Vector3Tuple } from "@solidloom/shared";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { loungeManifest } from "./manifest.js";
import {
  createLoungeKit,
  defaultLoungeParameters,
  getLoungeLayoutTransforms,
  getLoungeSofaSeatX,
  loungeDimensions,
  loungeFeatureIds,
  normalizeLoungeParameters,
  transformLoungePoint,
  type LoungeLayout,
  type LoungePalette,
  type LoungeParameters,
} from "./model.js";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`缺少预览元素：${id}`);
  return element as T;
}

const root = requiredElement<HTMLElement>("preview-root");
const canvas = requiredElement<HTMLCanvasElement>("preview-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x091013, 0.00009);
const camera = new THREE.PerspectiveCamera(34, 1, 1, 30_000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 4_200;
controls.maxDistance = 18_000;
controls.maxPolarAngle = Math.PI * 0.48;

scene.add(new THREE.HemisphereLight(0xd7fff7, 0x314146, 5.4));
const keyLight = new THREE.DirectionalLight(0xfff4dc, 9.2);
keyLight.position.set(5_400, 6_400, 6_200);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -5_500;
keyLight.shadow.camera.right = 5_500;
keyLight.shadow.camera.top = 5_500;
keyLight.shadow.camera.bottom = -5_500;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x69dfd1, 4.3);
rimLight.position.set(-4_800, 3_300, -3_500);
scene.add(rimLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(8_500, 96),
  new THREE.MeshStandardMaterial({ color: 0x10191b, roughness: 0.94, metalness: 0.04 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(16_000, 40, 0x315855, 0x192b2d);
grid.position.y = 1;
scene.add(grid);

let parameters: LoungeParameters = { ...defaultLoungeParameters };
let modelRoot = new THREE.Group();
let seatMarkerRoot = new THREE.Group();
let showSeatAnchors = true;
let showReferenceFigure = true;
let lampPointLight: THREE.PointLight | null = null;
let devicePreference: "auto" | ModelAssetDeviceClass = "auto";
let cameraDevice: ModelAssetDeviceClass | null = null;

const inputIds = ["sofa-width", "seat-height", "table-width", "rug-width"] as const;
const inputs = Object.fromEntries(inputIds.map((id) => [id, requiredElement<HTMLInputElement>(id)])) as Record<typeof inputIds[number], HTMLInputElement>;
const layoutSelect = requiredElement<HTMLSelectElement>("layout");
const paletteSelect = requiredElement<HTMLSelectElement>("palette");
const deviceSelect = requiredElement<HTMLSelectElement>("device");

function createReferenceFigure() {
  const figure = new THREE.Group();
  figure.name = "1720 毫米漫游角色比例尺";
  const pixel = loungeDimensions.referenceFigureHeight / 32;
  const skin = new THREE.MeshStandardMaterial({ color: 0xe7b25f, roughness: 0.72, metalness: 0.04 });
  const clothing = new THREE.MeshStandardMaterial({ color: 0x376f79, roughness: 0.88, metalness: 0.02 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x283b55, roughness: 0.9, metalness: 0.01 });
  const addPart = (
    size: Vector3Tuple,
    position: Vector3Tuple,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    figure.add(mesh);
  };
  addPart([8 * pixel, 8 * pixel, 8 * pixel], [0, 28 * pixel, 0], skin);
  addPart([8 * pixel, 12 * pixel, 4 * pixel], [0, 18 * pixel, 0], clothing);
  addPart([4 * pixel, 12 * pixel, 4 * pixel], [-6 * pixel, 18 * pixel, 0], clothing);
  addPart([4 * pixel, 12 * pixel, 4 * pixel], [6 * pixel, 18 * pixel, 0], clothing);
  addPart([4 * pixel, 12 * pixel, 4 * pixel], [-2 * pixel, 6 * pixel, 0], trousers);
  addPart([4 * pixel, 12 * pixel, 4 * pixel], [2 * pixel, 6 * pixel, 0], trousers);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(310, 12, 10, 48),
    new THREE.MeshBasicMaterial({ color: 0xe7b25f, toneMapped: false }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 8;
  figure.add(ring);
  return figure;
}

const referenceFigureRoot = createReferenceFigure();
scene.add(referenceFigureRoot);

function resolvedDevice(): ModelAssetDeviceClass {
  if (devicePreference !== "auto") return devicePreference;
  return window.innerWidth <= 640 ? "mobile" : "desktop";
}

function materialFor(feature: ModelFeature) {
  const preset = feature.appearance?.material ?? "default";
  const color = feature.appearance?.color ?? "#AAB4B9";
  const isGlass = preset === "glass";
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: preset === "fabric" ? 0.9 : preset === "wood" ? 0.62 : preset === "metal" ? 0.24 : 0.5,
    metalness: preset === "metal" ? 0.82 : 0.03,
    transparent: isGlass,
    opacity: isGlass ? 0.58 : 1,
    transmission: isGlass ? 0.2 : 0,
    depthWrite: !isGlass,
  });
  if (feature.id === loungeFeatureIds.lampLight) {
    material.emissive = new THREE.Color(parameters.lampOn ? color : "#202827");
    material.emissiveIntensity = parameters.lampOn ? 4.5 : 0.05;
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
    return new THREE.CylinderGeometry(feature.parameters.radius, feature.parameters.radius, feature.parameters.height, 28);
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

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Line)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
  object.removeFromParent();
}

function createSeatMarker(position: Vector3Tuple, rotationY: number, index: number) {
  const marker = new THREE.Group();
  const color = index < 3 ? 0x65e0d0 : 0x8fb8ff;
  const material = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    opacity: 1,
    toneMapped: false,
    transparent: true,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(95, 10, 10, 40), material);
  ring.rotation.x = Math.PI / 2;
  marker.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(28, 95, 14), material.clone());
  arrow.rotation.x = Math.PI / 2;
  arrow.position.z = 125;
  marker.add(arrow);
  marker.position.set(position[0], position[1] + 18, position[2]);
  marker.rotation.y = THREE.MathUtils.degToRad(rotationY);
  marker.renderOrder = 10;
  marker.userData.seatIndex = index;
  marker.userData.baseY = position[1] + 18;
  return marker;
}

function rebuildSeatMarkers() {
  disposeObject(seatMarkerRoot);
  seatMarkerRoot = new THREE.Group();
  const transforms = getLoungeLayoutTransforms(parameters);
  const sofaSeats = [-1, 0, 1].map((column) => ({
    position: transformLoungePoint([getLoungeSofaSeatX(parameters.sofaWidth, column as -1 | 0 | 1), parameters.seatHeight, 55], transforms.sofa),
    rotationY: transforms.sofa.rotationY,
  }));
  const chairSeats = [transforms.leftChair, transforms.rightChair].map((transform) => ({
    position: transformLoungePoint([0, parameters.seatHeight, 55], transform),
    rotationY: transform.rotationY,
  }));
  [...sofaSeats, ...chairSeats].forEach((seat, index) => {
    seatMarkerRoot.add(createSeatMarker(seat.position, seat.rotationY, index));
  });
  seatMarkerRoot.visible = showSeatAnchors;
  scene.add(seatMarkerRoot);
}

function rebuildModel() {
  disposeObject(modelRoot);
  modelRoot = new THREE.Group();
  lampPointLight = null;
  scene.add(modelRoot);
  const device = resolvedDevice();
  const graph = createLoungeKit(parameters).featureGraph!;
  const lod = loungeManifest.lod.find((profile) => profile.device === device)!.levels[0]!;
  const visibleIds = new Set(lod.featureIds);

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
    mesh.castShadow = feature.id !== loungeFeatureIds.rug;
    mesh.receiveShadow = true;
    modelRoot.add(mesh);
    if (feature.id === loungeFeatureIds.lampLight) {
      lampPointLight = new THREE.PointLight(0xffd58f, parameters.lampOn ? 180 : 0, 3_600, 1.7);
      lampPointLight.position.set(...feature.position);
      modelRoot.add(lampPointLight);
    }
  });

  referenceFigureRoot.position.set(
    device === "mobile" ? -450 : -parameters.rugWidth / 2 + 500,
    0,
    device === "mobile"
      ? 1_250
      : parameters.rugWidth * loungeDimensions.rug.depthRatio / 2 - 400,
  );
  referenceFigureRoot.rotation.y = THREE.MathUtils.degToRad(-24);
  referenceFigureRoot.visible = showReferenceFigure;

  if (cameraDevice !== device) {
    const preview = loungeManifest.previews.find((candidate) => candidate.device === device)!;
    camera.position.set(...preview.cameraPosition);
    controls.target.set(...preview.cameraTarget);
    camera.fov = device === "mobile" ? 38 : 34;
    camera.updateProjectionMatrix();
    controls.update();
    cameraDevice = device;
  }

  rebuildSeatMarkers();
  requiredElement("device-badge").textContent = device === "mobile" ? "手机简化层级" : "桌面完整层级";
  const layoutLabels: Record<LoungeLayout, string> = {
    conversation: "围合布局",
    linear: "并列布局",
    compact: "紧凑布局",
  };
  requiredElement("layout-badge").textContent = layoutLabels[parameters.layout];
  const lampBadge = requiredElement("lamp-badge");
  lampBadge.textContent = parameters.lampOn ? "落地灯：开启" : "落地灯：关闭";
  lampBadge.dataset.active = String(parameters.lampOn);
}

function updateParameters() {
  parameters = normalizeLoungeParameters({
    sofaWidth: Number(inputs["sofa-width"].value),
    seatHeight: Number(inputs["seat-height"].value),
    tableWidth: Number(inputs["table-width"].value),
    rugWidth: Number(inputs["rug-width"].value),
    layout: layoutSelect.value as LoungeLayout,
    palette: paletteSelect.value as LoungePalette,
    lampOn: parameters.lampOn,
  });
  const values: Record<typeof inputIds[number], number> = {
    "sofa-width": parameters.sofaWidth,
    "seat-height": parameters.seatHeight,
    "table-width": parameters.tableWidth,
    "rug-width": parameters.rugWidth,
  };
  inputIds.forEach((id) => {
    inputs[id].value = String(values[id]);
    requiredElement(`${id}-output`).textContent = `${values[id]} mm`;
  });
  rebuildModel();
}

inputIds.forEach((id) => inputs[id].addEventListener("input", updateParameters));
layoutSelect.addEventListener("change", updateParameters);
paletteSelect.addEventListener("change", updateParameters);
deviceSelect.addEventListener("change", () => {
  devicePreference = deviceSelect.value as typeof devicePreference;
  rebuildModel();
});
requiredElement<HTMLButtonElement>("lamp-toggle").addEventListener("click", (event) => {
  parameters = { ...parameters, lampOn: !parameters.lampOn };
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute("aria-pressed", String(parameters.lampOn));
  button.textContent = parameters.lampOn ? "关闭落地灯" : "开启落地灯";
  rebuildModel();
});
requiredElement<HTMLButtonElement>("anchor-toggle").addEventListener("click", (event) => {
  showSeatAnchors = !showSeatAnchors;
  seatMarkerRoot.visible = showSeatAnchors;
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute("aria-pressed", String(showSeatAnchors));
  button.textContent = showSeatAnchors ? "隐藏座位锚点" : "显示座位锚点";
});
requiredElement<HTMLButtonElement>("scale-toggle").addEventListener("click", (event) => {
  showReferenceFigure = !showReferenceFigure;
  referenceFigureRoot.visible = showReferenceFigure;
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute("aria-pressed", String(showReferenceFigure));
  button.textContent = showReferenceFigure ? "隐藏角色比例" : "显示角色比例";
});

function resize() {
  const width = root.clientWidth;
  const height = root.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  if (devicePreference === "auto") rebuildModel();
}

renderer.setAnimationLoop((time) => {
  controls.update();
  seatMarkerRoot.children.forEach((marker, index) => {
    marker.position.y = Number(marker.userData.baseY) + Math.sin(time * 0.0022 + index) * 5;
  });
  if (lampPointLight) {
    lampPointLight.intensity = parameters.lampOn ? 180 + Math.sin(time * 0.0025) * 14 : 0;
  }
  renderer.render(scene, camera);
});

window.addEventListener("resize", resize);
rebuildModel();
resize();
