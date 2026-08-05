import type { ModelAssetDefinition, ModelFeature, Vector3Tuple } from "@solidloom/shared";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  defaultWarehouseCartParameters,
  defaultWarehousePalletParameters,
  defaultWarehouseRackParameters,
  defaultWarehouseStackerCraneParameters,
  defaultWarehouseStackerCranePose,
  defaultWarehouseToteParameters,
  createWarehouseStackerCrane,
  planWarehouseRetrieval,
  warehouseRackBayX,
  warehouseRackShelfY,
  warehouseStackerRackAssemblyZ,
  type WarehouseCartParameters,
  type WarehousePalletParameters,
  type WarehouseRackParameters,
  type WarehouseRetrievalPlan,
  type WarehouseStackerCraneParameters,
  type WarehouseStackerCranePose,
  type WarehouseToteParameters,
} from "./model.js";
import {
  createWarehouseCartDefinition,
  createWarehousePalletDefinition,
  createWarehouseRackDefinition,
  createWarehouseStackerCraneDefinition,
  createWarehouseToteDefinition,
} from "./manifest.js";

type AssetKey = "rack" | "pallet" | "tote" | "cart" | "stacker";
type PreviewMode = "overview" | AssetKey;

interface ParameterControl {
  key: string;
  label: string;
  minimum: number;
  maximum?: number;
  step: number;
  unit?: string;
}

interface AssetPreviewConfig {
  title: string;
  summary: string;
  defaults: Record<string, number>;
  parameters: ParameterControl[];
  createDefinition: (parameters: Record<string, number>) => ModelAssetDefinition;
  cameraPosition: Vector3Tuple;
  cameraTarget: Vector3Tuple;
  minimumDistance: number;
  maximumDistance: number;
}

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`缺少仓储预览元素：${selector}`);
  return element;
}

function valuesOf(parameters: object): Record<string, number> {
  return { ...parameters } as Record<string, number>;
}

const assetConfigs: Record<AssetKey, AssetPreviewConfig> = {
  rack: {
    title: "参数化仓储货架",
    summary: "独立货架模型；跨数和层数变化时自动生成稳定货位、取货位与补货位。",
    defaults: valuesOf(defaultWarehouseRackParameters),
    parameters: [
      { key: "bayCount", label: "货架跨数", minimum: 1, step: 1 },
      { key: "levelCount", label: "货架层数", minimum: 2, step: 1 },
      { key: "bayWidth", label: "单跨宽度", minimum: 800, maximum: 1_400, step: 50, unit: "毫米" },
      { key: "height", label: "货架高度", minimum: 1_800, maximum: 3_600, step: 100, unit: "毫米" },
      { key: "depth", label: "货架深度", minimum: 600, maximum: 1_200, step: 50, unit: "毫米" },
    ],
    createDefinition: (parameters) => createWarehouseRackDefinition(parameters as Partial<WarehouseRackParameters>),
    cameraPosition: [4_800, 3_500, 5_900],
    cameraTarget: [0, 1_300, 0],
    minimumDistance: 2_800,
    maximumDistance: 14_000,
  },
  pallet: {
    title: "参数化仓储托盘",
    summary: "独立木质托盘模型；具有装载面和前后货叉入口。",
    defaults: valuesOf(defaultWarehousePalletParameters),
    parameters: [
      { key: "width", label: "托盘宽度", minimum: 800, maximum: 1_300, step: 50, unit: "毫米" },
      { key: "depth", label: "托盘深度", minimum: 600, maximum: 1_200, step: 50, unit: "毫米" },
      { key: "height", label: "托盘高度", minimum: 110, maximum: 190, step: 1, unit: "毫米" },
    ],
    createDefinition: (parameters) => createWarehousePalletDefinition(parameters as Partial<WarehousePalletParameters>),
    cameraPosition: [1_800, 1_100, 2_100],
    cameraTarget: [0, 120, 0],
    minimumDistance: 900,
    maximumDistance: 6_000,
  },
  tote: {
    title: "参数化仓储周转箱",
    summary: "独立开放式周转箱模型；内腔可挂接内容物，两侧提供搬运交互位。",
    defaults: valuesOf(defaultWarehouseToteParameters),
    parameters: [
      { key: "width", label: "周转箱宽度", minimum: 400, maximum: 800, step: 20, unit: "毫米" },
      { key: "depth", label: "周转箱深度", minimum: 300, maximum: 600, step: 20, unit: "毫米" },
      { key: "height", label: "周转箱高度", minimum: 240, maximum: 520, step: 20, unit: "毫米" },
    ],
    createDefinition: (parameters) => createWarehouseToteDefinition(parameters as Partial<WarehouseToteParameters>),
    cameraPosition: [1_300, 850, 1_500],
    cameraTarget: [0, 180, 0],
    minimumDistance: 700,
    maximumDistance: 5_000,
  },
  cart: {
    title: "参数化仓储推车",
    summary: "独立四轮物流推车模型；承载台、把手与搬运锚点可直接用于内部运输。",
    defaults: valuesOf(defaultWarehouseCartParameters),
    parameters: [
      { key: "width", label: "推车宽度", minimum: 650, maximum: 1_100, step: 50, unit: "毫米" },
      { key: "depth", label: "推车深度", minimum: 900, maximum: 1_500, step: 10, unit: "毫米" },
      { key: "deckHeight", label: "承载台高度", minimum: 240, maximum: 460, step: 10, unit: "毫米" },
      { key: "handleHeight", label: "把手高度", minimum: 720, maximum: 1_400, step: 20, unit: "毫米" },
    ],
    createDefinition: (parameters) => createWarehouseCartDefinition(parameters as Partial<WarehouseCartParameters>),
    cameraPosition: [2_100, 1_450, 2_700],
    cameraTarget: [0, 520, 0],
    minimumDistance: 1_200,
    maximumDistance: 7_000,
  },
  stacker: {
    title: "参数化巷道堆垛机",
    summary: "独立模型默认与货架拣选面贴合组合；跨度、高度、载货台和货叉仍可独立配置。",
    defaults: valuesOf(defaultWarehouseStackerCraneParameters),
    parameters: [
      { key: "railLength", label: "轨道长度", minimum: 3_500, maximum: 30_000, step: 500, unit: "毫米" },
      { key: "mastHeight", label: "立柱高度", minimum: 2_400, maximum: 8_000, step: 100, unit: "毫米" },
      { key: "carriageWidth", label: "载货台宽度", minimum: 700, maximum: 1_600, step: 50, unit: "毫米" },
      { key: "carriageDepth", label: "载货台深度", minimum: 600, maximum: 1_400, step: 50, unit: "毫米" },
      { key: "forkReach", label: "货叉行程", minimum: 400, maximum: 2_400, step: 50, unit: "毫米" },
    ],
    createDefinition: (parameters) => createWarehouseStackerCraneDefinition(parameters as Partial<WarehouseStackerCraneParameters>),
    cameraPosition: [4_600, 4_300, -5_800],
    cameraTarget: [900, 1_470, 700],
    minimumDistance: 3_200,
    maximumDistance: 18_000,
  },
};

const parameterValues = Object.fromEntries(
  Object.entries(assetConfigs).map(([key, config]) => [key, { ...config.defaults }]),
) as Record<AssetKey, Record<string, number>>;

const canvas = requiredElement<HTMLCanvasElement>("#preview");
const assetTitle = requiredElement<HTMLElement>("#asset-title");
const assetSummary = requiredElement<HTMLElement>("#asset-summary");
const parameterPanel = requiredElement<HTMLElement>("#parameter-panel");
const parameterControls = requiredElement<HTMLElement>("#parameter-controls");
const resetParameters = requiredElement<HTMLButtonElement>("#reset-parameters");
const stackerTaskPanel = requiredElement<HTMLElement>("#stacker-task-panel");
const stackerSlotId = requiredElement<HTMLInputElement>("#stacker-slot-id");
const runStackerDemo = requiredElement<HTMLButtonElement>("#run-stacker-demo");
const stackerTaskStatus = requiredElement<HTMLElement>("#stacker-task-status");
const metrics = requiredElement<HTMLElement>("#metrics");
const assetTabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-asset]"));

const quality = new URLSearchParams(window.location.search).get("quality") === "mobile" ? "mobile" : "desktop";
const defaultFogDensity = quality === "mobile" ? 0.000035 : 0.0001;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#172328");
scene.fog = new THREE.FogExp2("#172328", defaultFogDensity);

const camera = new THREE.PerspectiveCamera(quality === "mobile" ? 42 : 38, 1, 1, 24_000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === "desktop" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "desktop" ? 2 : 1.4));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
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
  new THREE.PlaneGeometry(60_000, 60_000),
  new THREE.MeshStandardMaterial({ color: "#2A3B41", roughness: 0.88, metalness: 0.08 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(60_000, 120, "#34565A", "#1E3236");
grid.position.y = 2;
scene.add(grid);

const assetLayer = new THREE.Group();
const markerLayer = new THREE.Group();
scene.add(assetLayer, markerLayer);

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

function buildAsset(definition: ModelAssetDefinition, position: Vector3Tuple, mirrorDepth = false) {
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
  root.scale.z = mirrorDepth ? -1 : 1;
  assetLayer.add(root);
  return visible.size;
}

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
  markerLayer.add(root);
}

function clearLayer(layer: THREE.Group) {
  for (const child of [...layer.children]) {
    child.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    layer.remove(child);
  }
}

function placeRepresentativeAnchors(definition: ModelAssetDefinition, offset: Vector3Tuple = [0, 0, 0]) {
  const anchors = definition.manifest.anchors;
  const selected = [];
  const socket = anchors.find(({ kind }) => kind === "socket");
  const approach = anchors.find(({ kind }) => kind === "approach");
  if (socket) selected.push(socket);
  selected.push(...anchors.filter(({ kind }) => kind === "interaction").slice(0, 2));
  if (approach) selected.push(approach);
  for (const anchor of selected) {
    const color = anchor.kind === "socket" ? "#54D5C4" : anchor.kind === "approach" ? "#9F8CFF" : "#F2C45F";
    marker(color, [
      anchor.position[0] + offset[0],
      anchor.position[1] + offset[1],
      anchor.position[2] + offset[2],
    ], anchor.kind === "approach" ? 45 : 34);
  }
}

function setCamera(position: Vector3Tuple, target: Vector3Tuple, minimumDistance: number, maximumDistance: number) {
  const mobileScale = quality === "mobile" ? 1.24 : 1;
  camera.position.set(position[0] * mobileScale, position[1] * mobileScale, position[2] * mobileScale);
  const cameraDistance = camera.position.distanceTo(new THREE.Vector3(...target));
  camera.far = Math.max(24_000, maximumDistance * 1.5);
  if (scene.fog instanceof THREE.FogExp2) scene.fog.density = Math.min(defaultFogDensity, 0.9 / cameraDistance);
  camera.updateProjectionMatrix();
  controls.target.set(...target);
  controls.minDistance = minimumDistance;
  controls.maxDistance = maximumDistance;
  controls.update();
}

function renderOverview() {
  const rack = createWarehouseRackDefinition(defaultWarehouseRackParameters);
  const pallet = createWarehousePalletDefinition(defaultWarehousePalletParameters);
  const tote = createWarehouseToteDefinition(defaultWarehouseToteParameters);
  const cart = createWarehouseCartDefinition(defaultWarehouseCartParameters);
  const stacker = createWarehouseStackerCraneDefinition(defaultWarehouseStackerCraneParameters);
  const rackPosition: Vector3Tuple = [-500, 0, -180];
  const stackerPosition: Vector3Tuple = [
    rackPosition[0],
    0,
    rackPosition[2] - warehouseStackerRackAssemblyZ(
      defaultWarehouseRackParameters,
      defaultWarehouseStackerCraneParameters,
    ),
  ];
  let drawUnits = buildAsset(rack, rackPosition);
  drawUnits += buildAsset(pallet, [
    rackPosition[0] + warehouseRackBayX(defaultWarehouseRackParameters, 0),
    warehouseRackShelfY(defaultWarehouseRackParameters, 0) + 22,
    rackPosition[2],
  ]);
  drawUnits += buildAsset(tote, [
    rackPosition[0] + warehouseRackBayX(defaultWarehouseRackParameters, 1),
    warehouseRackShelfY(defaultWarehouseRackParameters, 1) + 22,
    rackPosition[2],
  ]);
  drawUnits += buildAsset(tote, [
    rackPosition[0] + warehouseRackBayX(defaultWarehouseRackParameters, 2),
    warehouseRackShelfY(defaultWarehouseRackParameters, 2) + 22,
    rackPosition[2],
  ]);
  const cartPosition: Vector3Tuple = quality === "mobile" ? [1_450, 0, 260] : [2_300, 0, 420];
  drawUnits += buildAsset(cart, cartPosition);
  if (quality === "desktop") drawUnits += buildAsset(pallet, [2_150, 0, -1_050]);
  drawUnits += buildAsset(stacker, stackerPosition, true);
  placeRepresentativeAnchors(cart, cartPosition);
  setCamera([7_000, 4_600, 8_000], [0, 1_300, 100], 4_200, 20_000);
  return drawUnits;
}

function formatValue(value: number, unit?: string) {
  return `${new Intl.NumberFormat("zh-CN").format(value)}${unit ? ` ${unit}` : ""}`;
}

type ValidWarehouseRetrievalPlan = Extract<WarehouseRetrievalPlan, { valid: true }>;
type StackerCargoMode = "rack" | "fork" | "outbound";

interface StackerAnimationState {
  plan: ValidWarehouseRetrievalPlan;
  stepIndex: number;
  stepStartedAt: number;
  fromPose: WarehouseStackerCranePose;
  lastRenderedAt: number;
}

let stackerPose: WarehouseStackerCranePose = { ...defaultWarehouseStackerCranePose };
let stackerPlan: ValidWarehouseRetrievalPlan | null = null;
let stackerAnimation: StackerAnimationState | null = null;

function stackerDefinitionAtPose(pose: WarehouseStackerCranePose): ModelAssetDefinition {
  const parameters = parameterValues.stacker as unknown as WarehouseStackerCraneParameters;
  const definition = createWarehouseStackerCraneDefinition(parameters);
  return {
    manifest: definition.manifest,
    createModel: () => createWarehouseStackerCrane(parameters, pose),
  };
}

function activeStackerPlan() {
  if (stackerPlan) return stackerPlan;
  const plan = planWarehouseRetrieval(
    "warehouse-rack-slot-b03-l04",
    parameterValues.rack as unknown as WarehouseRackParameters,
    parameterValues.stacker as unknown as WarehouseStackerCraneParameters,
  );
  return plan.valid ? plan : null;
}

function renderStackerScene(
  pose: WarehouseStackerCranePose,
  cargoMode: StackerCargoMode,
  phaseLabel: string,
  resetCamera = false,
) {
  clearLayer(assetLayer);
  clearLayer(markerLayer);
  const rackParameters = parameterValues.rack as unknown as WarehouseRackParameters;
  const stackerParameters = parameterValues.stacker as unknown as WarehouseStackerCraneParameters;
  const rack = createWarehouseRackDefinition(rackParameters);
  const stacker = stackerDefinitionAtPose(pose);
  const pallet = createWarehousePalletDefinition(defaultWarehousePalletParameters);
  const plan = activeStackerPlan();
  const rackPosition: Vector3Tuple = [
    0,
    0,
    warehouseStackerRackAssemblyZ(rackParameters, stackerParameters),
  ];
  let drawUnits = buildAsset(rack, rackPosition);
  drawUnits += buildAsset(stacker, [0, 0, 0], true);
  if (plan) {
    const shelfY = warehouseRackShelfY(rackParameters, plan.levelIndex) + 22;
    let cargoPosition: Vector3Tuple;
    if (cargoMode === "rack") {
      cargoPosition = [plan.targetPose.travelX, shelfY, rackPosition[2]];
    } else if (cargoMode === "fork") {
      cargoPosition = [pose.travelX, pose.liftY + 32, -stackerParameters.carriageDepth / 2 - pose.forkExtension];
    } else {
      cargoPosition = [pose.travelX, pose.liftY + 32, 0];
    }
    drawUnits += buildAsset(pallet, cargoPosition);
    marker("#54D5C4", [
      plan.targetPose.travelX,
      shelfY + 120,
      rackPosition[2] + rackParameters.depth / 2 + 180,
    ], 42);
  }
  if (resetCamera) {
    const railLength = stackerParameters.railLength;
    const distance = Math.max(5_800, railLength * 0.9, stackerParameters.mastHeight * 1.8);
    setCamera(
      [distance * 0.8, Math.max(3_900, stackerParameters.mastHeight * 1.35), distance],
      [900, stackerParameters.mastHeight * 0.46, -700],
      3_200,
      Math.max(18_000, railLength * 2.5),
    );
  }
  metrics.textContent = `${quality === "mobile" ? "手机" : "桌面"}层级 · ${drawUnits} 个绘制单元 · ${phaseLabel}`;
}

function interpolatePose(from: WarehouseStackerCranePose, to: WarehouseStackerCranePose, progress: number) {
  const eased = progress * progress * (3 - 2 * progress);
  return {
    travelX: THREE.MathUtils.lerp(from.travelX, to.travelX, eased),
    liftY: THREE.MathUtils.lerp(from.liftY, to.liftY, eased),
    forkExtension: THREE.MathUtils.lerp(from.forkExtension, to.forkExtension, eased),
  };
}

function updateStackerAnimation(timestamp: number) {
  if (!stackerAnimation || currentMode !== "stacker") return;
  const step = stackerAnimation.plan.steps[stackerAnimation.stepIndex]!;
  const progress = Math.min(1, (timestamp - stackerAnimation.stepStartedAt) / step.durationMs);
  stackerPose = interpolatePose(stackerAnimation.fromPose, step.pose, progress);
  const cargoMode: StackerCargoMode = stackerAnimation.stepIndex < 4
    ? "rack"
    : stackerAnimation.stepIndex < 8 ? "fork" : "outbound";
  if (timestamp - stackerAnimation.lastRenderedAt >= 34 || progress === 1) {
    renderStackerScene(stackerPose, cargoMode, `当前步骤：${step.label}`);
    stackerTaskStatus.textContent = `${stackerAnimation.stepIndex + 1}/${stackerAnimation.plan.steps.length} · ${step.label}`;
    stackerAnimation.lastRenderedAt = timestamp;
  }
  if (progress < 1) return;
  if (stackerAnimation.stepIndex === stackerAnimation.plan.steps.length - 1) {
    stackerTaskStatus.textContent = `演示完成：${stackerAnimation.plan.slotId} 已运送到左侧载货台出库位。`;
    renderStackerScene(step.pose, "outbound", "取货演示完成");
    stackerAnimation = null;
    return;
  }
  stackerAnimation.fromPose = { ...step.pose };
  stackerAnimation.stepIndex += 1;
  stackerAnimation.stepStartedAt = timestamp;
}

let currentMode: PreviewMode = "overview";

function renderCurrentMode() {
  clearLayer(assetLayer);
  clearLayer(markerLayer);
  if (currentMode === "overview") {
    const drawUnits = renderOverview();
    assetTitle.textContent = "仓储与内部物流套件";
    assetSummary.textContent = "五项资产可独立引用，也可通过货位与搬运锚点组合。";
    metrics.textContent = `${quality === "mobile" ? "手机" : "桌面"}层级 · ${drawUnits} 个绘制单元 · 5 项独立资产`;
    return;
  }

  const config = assetConfigs[currentMode];
  if (currentMode === "stacker") {
    assetTitle.textContent = config.title;
    assetSummary.textContent = config.summary;
    renderStackerScene(stackerPose, "rack", "等待格口取货指令", true);
    return;
  }
  const definition = config.createDefinition(parameterValues[currentMode]);
  const drawUnits = buildAsset(definition, [0, 0, 0]);
  placeRepresentativeAnchors(definition);
  if (currentMode === "rack") {
    const rack = parameterValues.rack;
    const totalWidth = rack.bayCount! * rack.bayWidth!;
    const distance = Math.max(5_900, totalWidth * 0.85, rack.height! * 2.25);
    setCamera(
      [distance * 0.8, Math.max(3_500, rack.height! * 1.35), distance],
      [0, rack.height! / 2, 0],
      Math.max(2_800, totalWidth * 0.55),
      Math.max(18_000, totalWidth * 3),
    );
  } else {
    setCamera(config.cameraPosition, config.cameraTarget, config.minimumDistance, config.maximumDistance);
  }
  assetTitle.textContent = config.title;
  assetSummary.textContent = config.summary;
  metrics.textContent = `${quality === "mobile" ? "手机" : "桌面"}层级 · ${drawUnits} 个绘制单元 · 独立模型：${definition.manifest.id}`;
}

function renderParameterControls(asset: AssetKey) {
  const config = assetConfigs[asset];
  parameterControls.replaceChildren();
  for (const parameter of config.parameters) {
    const row = document.createElement("div");
    row.className = "parameter-control";
    const inputId = `parameter-${asset}-${parameter.key}`;
    const label = document.createElement("label");
    label.htmlFor = inputId;
    label.textContent = parameter.label;
    const input = document.createElement("input");
    input.id = inputId;
    const hasMaximum = parameter.maximum !== undefined;
    input.type = hasMaximum ? "range" : "number";
    input.min = String(parameter.minimum);
    if (hasMaximum) input.max = String(parameter.maximum);
    input.step = String(parameter.step);
    input.value = String(parameterValues[asset][parameter.key]);
    const value = document.createElement("output");
    value.className = "parameter-value";
    value.htmlFor = inputId;
    value.textContent = hasMaximum
      ? formatValue(parameterValues[asset][parameter.key]!, parameter.unit)
      : "无预设上限";
    input.addEventListener("input", () => {
      const nextValue = Number(input.value);
      if (!Number.isFinite(nextValue) || nextValue < parameter.minimum) return;
      parameterValues[asset][parameter.key] = hasMaximum ? nextValue : Math.round(nextValue);
      if (hasMaximum) value.textContent = formatValue(parameterValues[asset][parameter.key]!, parameter.unit);
      if (asset === "stacker") {
        stackerAnimation = null;
        stackerPlan = null;
        stackerPose = { ...defaultWarehouseStackerCranePose };
        stackerTaskStatus.textContent = "参数已更新，请重新执行取货演示。";
      }
      renderCurrentMode();
    });
    row.append(label, input, value);
    parameterControls.append(row);
  }
}

function isPreviewMode(value: string | undefined): value is PreviewMode {
  return value === "overview" || value === "rack" || value === "pallet" || value === "tote" || value === "cart" || value === "stacker";
}

function selectMode(mode: PreviewMode) {
  currentMode = mode;
  for (const tab of assetTabs) tab.setAttribute("aria-pressed", String(tab.dataset.asset === mode));
  parameterPanel.hidden = mode === "overview";
  stackerTaskPanel.hidden = mode !== "stacker";
  stackerAnimation = null;
  if (mode === "stacker") {
    stackerPose = { ...defaultWarehouseStackerCranePose };
    stackerPlan = null;
    stackerTaskStatus.removeAttribute("data-error");
    stackerTaskStatus.textContent = "输入稳定格口 ID 后生成动作计划。";
  }
  if (mode !== "overview") renderParameterControls(mode);
  renderCurrentMode();
}

for (const tab of assetTabs) {
  tab.addEventListener("click", () => {
    if (isPreviewMode(tab.dataset.asset)) selectMode(tab.dataset.asset);
  });
}

resetParameters.addEventListener("click", () => {
  if (currentMode === "overview") return;
  parameterValues[currentMode] = { ...assetConfigs[currentMode].defaults };
  if (currentMode === "stacker") {
    stackerAnimation = null;
    stackerPlan = null;
    stackerPose = { ...defaultWarehouseStackerCranePose };
    stackerTaskStatus.textContent = "参数已恢复，请重新执行取货演示。";
  }
  renderParameterControls(currentMode);
  renderCurrentMode();
});

function normalizedSlotId(value: string) {
  const trimmed = value.trim().toLowerCase();
  return /^b0*[1-9][0-9]*-l0*[1-9][0-9]*$/.test(trimmed)
    ? `warehouse-rack-slot-${trimmed}`
    : trimmed;
}

runStackerDemo.addEventListener("click", () => {
  const slotId = normalizedSlotId(stackerSlotId.value);
  stackerSlotId.value = slotId;
  const plan = planWarehouseRetrieval(
    slotId,
    parameterValues.rack as unknown as WarehouseRackParameters,
    parameterValues.stacker as unknown as WarehouseStackerCraneParameters,
  );
  if (!plan.valid) {
    stackerAnimation = null;
    stackerPlan = null;
    stackerPose = { ...defaultWarehouseStackerCranePose };
    stackerTaskStatus.dataset.error = "true";
    stackerTaskStatus.textContent = plan.message;
    renderStackerScene(stackerPose, "rack", "格口校验失败");
    return;
  }
  stackerTaskStatus.removeAttribute("data-error");
  stackerPlan = plan;
  stackerPose = { ...defaultWarehouseStackerCranePose };
  stackerAnimation = {
    plan,
    stepIndex: 0,
    stepStartedAt: performance.now(),
    fromPose: { ...stackerPose },
    lastRenderedAt: 0,
  };
  stackerTaskStatus.textContent = `已生成 ${plan.steps.length} 步动作计划，准备取出 ${plan.slotId}。`;
  renderStackerScene(stackerPose, "rack", "取货计划已生成");
});

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function render(timestamp = 0) {
  updateStackerAnimation(timestamp);
  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(render);
}

window.addEventListener("resize", resize);
selectMode("overview");
resize();
render();
