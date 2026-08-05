import type { ModelAssetDefinition, ModelFeature, Vector3Tuple } from "@solidloom/shared";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  defaultWarehouseRackParameters,
  warehouseRackBayX,
  warehouseRackShelfY,
} from "./model.js";
import {
  warehouseCartDefinition,
  warehousePalletDefinition,
  warehouseRackDefinition,
  warehouseToteDefinition,
} from "./manifest.js";

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`缺少仓储预览元素：${selector}`);
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>("#preview");
const metrics = requiredElement<HTMLElement>("#metrics");

const quality = new URLSearchParams(window.location.search).get("quality") === "mobile" ? "mobile" : "desktop";
const scene = new THREE.Scene();
scene.background = new THREE.Color("#172328");
scene.fog = new THREE.FogExp2("#172328", quality === "mobile" ? 0.000035 : 0.0001);

const camera = new THREE.PerspectiveCamera(quality === "mobile" ? 42 : 38, 1, 1, 24_000);
camera.position.set(...(quality === "mobile"
  ? [7_500, 4_200, 9_300] as Vector3Tuple
  : [5_300, 3_700, 6_500] as Vector3Tuple));
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === "desktop" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "desktop" ? 2 : 1.4));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(180, 1_150, 0);
controls.minDistance = 3_600;
controls.maxDistance = 18_000;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight("#E5FFFB", "#23373D", 4.2));
scene.add(new THREE.AmbientLight("#DDEEEE", 1.5));
const key = new THREE.DirectionalLight("#FFFFFF", 5.2);
key.position.set(4_000, 6_000, 4_400);
key.castShadow = true;
key.shadow.mapSize.set(2_048, 2_048);
key.shadow.camera.left = -4_500;
key.shadow.camera.right = 4_500;
key.shadow.camera.top = 4_500;
key.shadow.camera.bottom = -1_200;
scene.add(key);
const rim = new THREE.DirectionalLight("#78E5D8", 3.8);
rim.position.set(-4_000, 2_800, -3_000);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(12_000, 12_000),
  new THREE.MeshStandardMaterial({ color: "#2A3B41", roughness: 0.88, metalness: 0.08 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(12_000, 40, "#34565A", "#1E3236");
grid.position.y = 2;
scene.add(grid);

function materialFor(feature: ModelFeature) {
  const preset = feature.appearance?.material ?? "default";
  const glass = preset === "glass";
  const metal = preset === "metal";
  return new THREE.MeshPhysicalMaterial({
    color: feature.appearance?.color ?? "#96A7AA",
    roughness: metal ? 0.3 : preset === "wood" ? 0.64 : preset === "rubber" ? 0.86 : 0.44,
    metalness: metal ? 0.74 : 0.04,
    transparent: glass,
    opacity: glass ? 0.4 : 1,
    transmission: glass ? 0.25 : 0,
    depthWrite: !glass,
  });
}

function geometryFor(feature: ModelFeature) {
  if (feature.type === "box") {
    const radius = feature.parameters.cornerRadius ?? 0;
    if (radius > 0) {
      return new RoundedBoxGeometry(
        feature.parameters.width,
        feature.parameters.height,
        feature.parameters.depth,
        quality === "desktop" ? 3 : 2,
        Math.min(radius, feature.parameters.width / 2, feature.parameters.height / 2, feature.parameters.depth / 2),
      );
    }
    return new THREE.BoxGeometry(feature.parameters.width, feature.parameters.height, feature.parameters.depth);
  }
  if (feature.type === "cylinder") {
    return new THREE.CylinderGeometry(
      feature.parameters.radius,
      feature.parameters.radius,
      feature.parameters.height,
      quality === "desktop" ? 24 : 10,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(feature.parameters.positions, 3));
  if (feature.parameters.indices.length > 0) geometry.setIndex(feature.parameters.indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildAsset(definition: ModelAssetDefinition, position: Vector3Tuple) {
  const graph = definition.createModel().featureGraph!;
  const lod = definition.manifest.lod.find(({ device }) => device === quality)!.levels[0]!;
  const visible = new Set(lod.featureIds ?? graph.features.map(({ id }) => id));
  const root = new THREE.Group();
  for (const feature of graph.features) {
    if (!visible.has(feature.id)) continue;
    const mesh = new THREE.Mesh(geometryFor(feature), materialFor(feature));
    mesh.position.set(...feature.position);
    mesh.rotation.set(...feature.rotation.map(THREE.MathUtils.degToRad) as Vector3Tuple);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = feature.id;
    root.add(mesh);
  }
  root.position.set(...position);
  scene.add(root);
  return visible.size;
}

let drawUnits = 0;
const rackPosition: Vector3Tuple = [-500, 0, -180];
drawUnits += buildAsset(warehouseRackDefinition, rackPosition);
drawUnits += buildAsset(warehousePalletDefinition, [rackPosition[0] + warehouseRackBayX(defaultWarehouseRackParameters, 0), warehouseRackShelfY(defaultWarehouseRackParameters, 0) + 22, rackPosition[2]]);
drawUnits += buildAsset(warehouseToteDefinition, [rackPosition[0] + warehouseRackBayX(defaultWarehouseRackParameters, 1), warehouseRackShelfY(defaultWarehouseRackParameters, 1) + 22, rackPosition[2]]);
drawUnits += buildAsset(warehouseToteDefinition, [rackPosition[0] + warehouseRackBayX(defaultWarehouseRackParameters, 2), warehouseRackShelfY(defaultWarehouseRackParameters, 2) + 22, rackPosition[2]]);
const cartPosition: Vector3Tuple = quality === "mobile" ? [1_450, 0, 260] : [2_300, 0, 420];
drawUnits += buildAsset(warehouseCartDefinition, cartPosition);
if (quality === "desktop") drawUnits += buildAsset(warehousePalletDefinition, [2_150, 0, -1_050]);
metrics.textContent = `${quality === "mobile" ? "手机" : "桌面"}层级 · ${drawUnits} 个绘制单元 · 4 项独立资产`;

function marker(color: string, position: Vector3Tuple, radius = 38) {
  const root = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 7, 10, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }),
  );
  ring.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 10), new THREE.MeshBasicMaterial({ color }));
  root.add(ring, core);
  root.position.set(...position);
  scene.add(root);
}

const rackAnchors = warehouseRackDefinition.manifest.anchors;
for (const anchor of rackAnchors.filter(({ id }) => id.startsWith("warehouse-rack-slot-b02-")).slice(0, 3)) {
  marker("#54D5C4", [anchor.position[0] + rackPosition[0], anchor.position[1], anchor.position[2] + rackPosition[2]], 30);
}
const pick = rackAnchors.find(({ id }) => id === "warehouse-rack-pick-b02-l01")!;
marker("#F2C45F", [pick.position[0] + rackPosition[0], pick.position[1], pick.position[2] + rackPosition[2]], 45);
const restock = rackAnchors.find(({ id }) => id === "warehouse-rack-restock-b02-l02")!;
marker("#EE855E", [restock.position[0] + rackPosition[0], restock.position[1], restock.position[2] + rackPosition[2]], 42);
const push = warehouseCartDefinition.manifest.anchors.find(({ id }) => id === "warehouse-cart-push-handle")!;
marker("#9F8CFF", [push.position[0] + cartPosition[0], push.position[1], push.position[2] + cartPosition[2]], 46);

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function render() {
  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(render);
}

window.addEventListener("resize", resize);
resize();
render();
