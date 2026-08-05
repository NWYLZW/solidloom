import type { ModelAssetDeviceClass, ModelFeature } from "@solidloom/shared";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { getCoffeeBrewAnimationFrame } from "./brew-animation.js";
import { coffeeMachineManifest } from "./manifest.js";
import {
  coffeeMachineFeatureIds,
  coffeeMachineJointIds,
  createCoffeeMachine,
  defaultCoffeeMachineParameters,
  type CoffeeMachineFinish,
  type CoffeeMachineParameters,
} from "./model.js";
import {
  brewCoffee,
  configureCoffeeMachineSupplies,
  defaultCoffeeRecipes,
  getCoffeeStockShortages,
  refillCoffeeMachineSupplies,
  type CoffeeMachineStock,
  type CoffeeRecipe,
} from "./operations.js";

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
let userNearby = false;
const supplyConfiguration = configureCoffeeMachineSupplies();
let stock: CoffeeMachineStock = {
  ...supplyConfiguration.initialStock,
  beansGrams: { ...supplyConfiguration.initialStock.beansGrams },
};
let selectedRecipeId: string | null = null;
let displayMaterial: THREE.MeshPhysicalMaterial | null = null;
let statusLightMaterial: THREE.MeshPhysicalMaterial | null = null;

interface ActiveBrew {
  recipe: CoffeeRecipe;
  startedAt: number;
}

interface BrewVisuals {
  cup: THREE.Group;
  liquid: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshPhysicalMaterial>;
  liquidBaseY: number;
  liquidHeight: number;
  pulseLight: THREE.PointLight;
  root: THREE.Group;
  steamMaterial: THREE.MeshBasicMaterial;
  steamParticles: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[];
  stream: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshPhysicalMaterial>;
}

let activeBrew: ActiveBrew | null = null;
let brewVisuals: BrewVisuals | null = null;

const coffeeImageByRecipeId: Record<string, string> = {
  espresso: "./images/espresso.svg",
  americano: "./images/americano.svg",
  latte: "./images/latte.svg",
  cappuccino: "./images/cappuccino.svg",
  "decaf-americano": "./images/decaf-americano.svg",
};

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
    material.emissiveIntensity = parameters.powered ? 1.25 : 0.08;
  }
  if (feature.id === coffeeMachineFeatureIds.statusLight) {
    material.emissive = new THREE.Color(color);
    material.emissiveIntensity = parameters.powered ? 3.4 : 0.05;
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

function createBrewVisuals(graph: NonNullable<ReturnType<typeof createCoffeeMachine>["featureGraph"]>): BrewVisuals {
  const spout = graph.features.find((feature) => feature.id === coffeeMachineFeatureIds.spout);
  const tray = graph.features.find((feature) => feature.id === coffeeMachineFeatureIds.tray);
  if (!spout || spout.type !== "cylinder" || !tray || tray.type !== "box") {
    throw new Error("咖啡机预览缺少出液口或托盘几何。");
  }

  const root = new THREE.Group();
  root.name = "咖啡制作动画";
  const cup = new THREE.Group();
  cup.name = "制作杯";
  const cupRadius = Math.min(parameters.width * 0.12, 48);
  const cupHeight = Math.min(64, Math.max(50, parameters.height * 0.105));
  const cupBaseY = tray.position[1] + tray.parameters.height / 2 + 4;
  const cupZ = spout.position[2];
  const ceramicMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe7eeeb,
    roughness: 0.34,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const cupBody = new THREE.Mesh(
    new THREE.CylinderGeometry(cupRadius * 0.9, cupRadius, cupHeight, 32, 1, true),
    ceramicMaterial,
  );
  cupBody.position.set(0, cupBaseY + cupHeight / 2, cupZ);
  cup.add(cupBody);

  const cupBase = new THREE.Mesh(
    new THREE.CylinderGeometry(cupRadius * 0.93, cupRadius * 0.93, 4, 32),
    ceramicMaterial.clone(),
  );
  cupBase.position.set(0, cupBaseY + 2, cupZ);
  cup.add(cupBase);

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(cupRadius * 0.92, 2.6, 10, 36),
    ceramicMaterial.clone(),
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.set(0, cupBaseY + cupHeight, cupZ);
  cup.add(lip);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(cupRadius * 0.42, 5, 12, 28, Math.PI * 1.75),
    ceramicMaterial.clone(),
  );
  handle.position.set(cupRadius * 0.98, cupBaseY + cupHeight * 0.54, cupZ);
  handle.rotation.z = Math.PI * 0.12;
  cup.add(handle);
  root.add(cup);

  const liquidHeight = cupHeight * 0.72;
  const liquidBaseY = cupBaseY + 5;
  const liquidMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x4b1f0e,
    emissive: 0x1f0903,
    emissiveIntensity: 0.25,
    roughness: 0.24,
    metalness: 0,
  });
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(cupRadius * 0.82, cupRadius * 0.82, liquidHeight, 32),
    liquidMaterial,
  );
  liquid.scale.y = 0.02;
  liquid.position.set(0, liquidBaseY + liquidHeight * 0.01, cupZ);
  root.add(liquid);

  const spoutBottomY = spout.position[1] - spout.parameters.height / 2;
  const streamBottomY = cupBaseY + cupHeight + 3;
  const streamHeight = Math.max(8, spoutBottomY - streamBottomY);
  const streamMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb45123,
    emissive: 0x6b2108,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0,
    roughness: 0.2,
  });
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 3.2, streamHeight, 14),
    streamMaterial,
  );
  stream.position.set(0, streamBottomY + streamHeight / 2, cupZ);
  stream.visible = false;
  root.add(stream);

  const steamMaterial = new THREE.MeshBasicMaterial({
    color: 0xe8fffb,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const steamParticles = Array.from({ length: 9 }, (_, index) => {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(7 + index % 3 * 2, 12, 8),
      steamMaterial,
    );
    particle.userData.steamIndex = index;
    root.add(particle);
    return particle;
  });

  const pulseLight = new THREE.PointLight(0x58d7c5, 0, 520, 2);
  pulseLight.position.set(0, spout.position[1] + 80, spout.position[2] + 70);
  root.add(pulseLight);
  root.visible = false;
  modelRoot.add(root);

  return {
    cup,
    liquid,
    liquidBaseY,
    liquidHeight,
    pulseLight,
    root,
    steamMaterial,
    steamParticles,
    stream,
  };
}

function resolvedDevice(): ModelAssetDeviceClass {
  if (devicePreference !== "auto") return devicePreference;
  return window.innerWidth <= 640 ? "mobile" : "desktop";
}

function createAnchorMarker(
  id: "brew-coffee" | "cup-socket" | "front-approach" | "power-toggle" | "take-cup",
  color: number,
  radius: number,
) {
  const anchor = coffeeMachineManifest.anchors.find((candidate) => candidate.id === id)!;
  const marker = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 5, 10, 36), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  const ringY = id === "cup-socket" ? anchor.position[1] : 5;
  ring.position.set(anchor.position[0], ringY, anchor.position[2]);
  marker.add(ring);
  if (id !== "cup-socket" && id !== "front-approach") {
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
  brewVisuals = null;
  displayMaterial = null;
  statusLightMaterial = null;

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
    if (feature.id === coffeeMachineFeatureIds.display) {
      displayMaterial = mesh.material as THREE.MeshPhysicalMaterial;
    }
    if (feature.id === coffeeMachineFeatureIds.statusLight) {
      statusLightMaterial = mesh.material as THREE.MeshPhysicalMaterial;
    }
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
  modelRoot.add(createAnchorMarker("front-approach", 0xd59cf4, 120));
  modelRoot.add(createAnchorMarker("power-toggle", 0xf3d45c, 30));
  modelRoot.add(createAnchorMarker("take-cup", 0xf1ae62, 32));
  modelRoot.add(createAnchorMarker("cup-socket", 0x88aef0, 48));
  brewVisuals = createBrewVisuals(graph);
  if (selectedRecipeId !== null && activeBrew === null) {
    brewVisuals.root.visible = true;
    brewVisuals.liquid.scale.y = 1;
    brewVisuals.liquid.position.y = brewVisuals.liquidBaseY + brewVisuals.liquidHeight / 2;
  }

  requiredElement("device-badge").textContent = device === "mobile" ? "手机简化层级" : "桌面完整层级";
  requiredElement("dimension-badge").textContent = `${parameters.width} × ${parameters.height} × ${parameters.depth} mm`;
  requiredElement("power-badge").textContent = parameters.powered ? "电源：开启" : "电源：关闭";
  renderMenu();
}

function setBrewFeedback(
  message: string,
  options: { active?: boolean; error?: boolean; progress?: number } = {},
) {
  const feedback = requiredElement("brew-feedback");
  const progress = Math.min(1, Math.max(0, options.progress ?? 0));
  feedback.dataset.active = String(options.active ?? false);
  feedback.dataset.error = String(options.error ?? false);
  feedback.dataset.visible = String(message.length > 0);
  requiredElement("brew-feedback-text").textContent = message;
  requiredElement("brew-progress-fill").style.transform = `scaleX(${progress})`;
}

function setControlsLocked(locked: boolean) {
  root.setAttribute("aria-busy", String(locked));
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
    ".controls input, .controls select, .controls button",
  ).forEach((control) => {
    control.disabled = locked;
  });
}

function renderRecipes() {
  const grid = requiredElement("recipe-grid");
  const isBrewing = activeBrew !== null;
  grid.dataset.brewing = String(isBrewing);
  const cards = defaultCoffeeRecipes.map((recipe) => {
    const shortages = getCoffeeStockShortages(stock, recipe);
    const button = document.createElement("button");
    button.className = "coffee-choice";
    button.type = "button";
    button.disabled = isBrewing || shortages.length > 0;
    button.dataset.selected = String(selectedRecipeId === recipe.id);
    button.setAttribute("aria-pressed", String(selectedRecipeId === recipe.id));
    button.setAttribute(
      "aria-label",
      isBrewing && selectedRecipeId === recipe.id
        ? `${recipe.name}正在制作`
        : shortages.length > 0
          ? `${recipe.name}，暂时缺货`
          : `选择${recipe.name}`,
    );

    const image = document.createElement("img");
    image.className = "coffee-image";
    image.src = coffeeImageByRecipeId[recipe.id] ?? "./images/americano.svg";
    image.alt = "";
    image.draggable = false;

    const name = document.createElement("strong");
    name.className = "coffee-name";
    name.textContent = recipe.name;
    button.append(image, name);
    if (shortages.length > 0) {
      const unavailable = document.createElement("span");
      unavailable.className = "coffee-unavailable";
      unavailable.textContent = "缺货";
      button.append(unavailable);
    }
    button.addEventListener("click", () => runRecipe(recipe));
    return button;
  });
  grid.replaceChildren(...cards);
}

function renderMenu() {
  const visible = parameters.powered && userNearby;
  const menu = requiredElement("virtual-menu");
  menu.dataset.visible = String(visible);
  menu.setAttribute("aria-hidden", String(!visible));

  const proximityBadge = requiredElement("proximity-badge");
  proximityBadge.textContent = userNearby ? "用户：附近" : "用户：远离";
  proximityBadge.dataset.active = String(userNearby);
  requiredElement("power-badge").dataset.active = String(parameters.powered);

  renderRecipes();
}

function runRecipe(recipe: CoffeeRecipe) {
  if (activeBrew !== null) return;
  if (!parameters.powered || !userNearby) {
    setBrewFeedback("需要开启电源并进入接近范围。", { error: true });
    return;
  }
  const result = brewCoffee(stock, recipe);
  if (!result.ok) {
    setBrewFeedback(`${recipe.name}暂时缺货。`, { error: true });
    renderMenu();
    return;
  }
  stock = result.stock;
  selectedRecipeId = recipe.id;
  activeBrew = { recipe, startedAt: performance.now() };
  setControlsLocked(true);
  setBrewFeedback(`${recipe.name} · 正在预热 0%`, { active: true });
  renderMenu();
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
requiredElement<HTMLButtonElement>("power-toggle").addEventListener("click", (event) => {
  parameters = { ...parameters, powered: !parameters.powered };
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute("aria-pressed", String(parameters.powered));
  button.textContent = parameters.powered ? "关闭电源" : "开启电源";
  if (parameters.powered && userNearby) {
    setBrewFeedback("");
  } else if (!parameters.powered && userNearby) {
    setBrewFeedback("已检测到用户，但机器尚未开启。", { error: true });
  }
  rebuildModel();
});
requiredElement<HTMLButtonElement>("proximity-toggle").addEventListener("click", (event) => {
  userNearby = !userNearby;
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute("aria-pressed", String(userNearby));
  button.textContent = userNearby ? "模拟用户离开" : "模拟用户接近";
  if (userNearby && !parameters.powered) {
    setBrewFeedback("已检测到用户，但机器尚未开启。", { error: true });
  } else if (userNearby) {
    setBrewFeedback("");
  }
  renderMenu();
});
requiredElement<HTMLButtonElement>("refill-stock").addEventListener("click", () => {
  stock = refillCoffeeMachineSupplies(supplyConfiguration);
  setBrewFeedback("耗材已补满。");
  renderMenu();
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

function updateBrewAnimation(time: number) {
  if (activeBrew === null) return;
  const { recipe, startedAt } = activeBrew;
  const frame = getCoffeeBrewAnimationFrame(time - startedAt, recipe);
  const percent = Math.round(frame.progress * 100);
  root.dataset.brewStage = frame.stage;
  setBrewFeedback(`${recipe.name} · ${frame.label} ${percent}%`, {
    active: !frame.completed,
    progress: frame.progress,
  });

  if (brewVisuals) {
    const visuals = brewVisuals;
    visuals.root.visible = true;
    visuals.cup.scale.setScalar(0.96 + Math.min(frame.progress / 0.12, 1) * 0.04);
    visuals.stream.visible = frame.streamOpacity > 0.01;
    visuals.stream.material.opacity = frame.streamOpacity * 0.9;
    const streamPulse = 0.88 + Math.sin(time * 0.018) * 0.12;
    visuals.stream.scale.set(streamPulse, 1, streamPulse);

    const liquidLevel = Math.max(0.02, frame.liquidLevel);
    visuals.liquid.scale.y = liquidLevel;
    visuals.liquid.position.y = visuals.liquidBaseY + visuals.liquidHeight * liquidLevel / 2;

    visuals.steamMaterial.opacity = frame.steamOpacity * 0.66;
    const steamBaseY = visuals.liquidBaseY + visuals.liquidHeight + 5;
    visuals.steamParticles.forEach((particle, index) => {
      const phase = (time * 0.00032 + index / visuals.steamParticles.length) % 1;
      particle.visible = frame.steamOpacity > 0.01;
      particle.position.set(
        Math.sin(phase * Math.PI * 2 + index) * (10 + index * 1.8),
        steamBaseY + phase * 92,
        visuals.stream.position.z + Math.cos(phase * Math.PI * 2 + index) * 12,
      );
      particle.scale.setScalar(0.45 + phase * 0.85);
    });
    visuals.pulseLight.intensity = frame.completed ? 7 : frame.indicatorIntensity * 8;
  }

  modelRoot.position.y = frame.machineVibration;
  if (statusLightMaterial) statusLightMaterial.emissiveIntensity = frame.indicatorIntensity;
  if (displayMaterial) displayMaterial.emissiveIntensity = 1.2 + frame.displayPulse * 1.8;

  if (!frame.completed) return;
  activeBrew = null;
  modelRoot.position.y = 0;
  if (brewVisuals) {
    brewVisuals.stream.visible = false;
    brewVisuals.steamParticles.forEach((particle) => { particle.visible = false; });
  }
  if (statusLightMaterial) statusLightMaterial.emissiveIntensity = 3.4;
  if (displayMaterial) displayMaterial.emissiveIntensity = 1.25;
  setControlsLocked(false);
  setBrewFeedback(`${recipe.name}制作完成，可以取杯。`, { progress: 1 });
  renderMenu();
}

let previousTime = 0;
renderer.setAnimationLoop((time) => {
  controls.update();
  if (lidPivot) {
    const target = THREE.MathUtils.degToRad(lidOpen ? -72 : 0);
    lidPivot.rotation.x = THREE.MathUtils.damp(lidPivot.rotation.x, target, 8, (time - previousTime) / 1000);
  }
  updateBrewAnimation(time);
  previousTime = time;
  renderer.render(scene, camera);
});

window.addEventListener("resize", resize);
rebuildModel();
resize();
