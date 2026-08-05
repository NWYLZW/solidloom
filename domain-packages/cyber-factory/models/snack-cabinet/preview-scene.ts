import type { ModelAssetDeviceClass, ModelFeature, Vector3Tuple } from "@solidloom/shared";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { snackCabinetManifest } from "./manifest.js";
import {
  createSnackCabinet,
  defaultSnackCabinetParameters,
  snackCabinetFeatureIds,
  snackCabinetJointIds,
  type SnackCabinetParameters,
} from "./model.js";

const packetRows = new Set<string>([
  snackCabinetFeatureIds.productRowOne,
  snackCabinetFeatureIds.productRowTwo,
  snackCabinetFeatureIds.productRowThree,
]);

function materialFor(feature: ModelFeature) {
  const color = feature.appearance?.color ?? "#A8B6B8";
  const preset = feature.appearance?.material ?? "default";
  const isGlass = preset === "glass";
  const isMetal = preset === "metal";
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: isMetal ? 0.26 : preset === "rubber" ? 0.8 : 0.42,
    metalness: isMetal ? 0.78 : 0.04,
    transparent: isGlass,
    opacity: isGlass ? 0.36 : 1,
    transmission: isGlass ? 0.32 : 0,
    thickness: isGlass ? 10 : 0,
    depthWrite: !isGlass,
    side: isGlass ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (feature.id === snackCabinetFeatureIds.statusLight) {
    material.emissive = new THREE.Color(color);
    material.emissiveIntensity = 2.2;
  }
  if (feature.id === snackCabinetFeatureIds.paymentDisplay) {
    material.emissive = new THREE.Color("#163C43");
    material.emissiveIntensity = 0.9;
  }
  return material;
}

function geometryFor(feature: ModelFeature) {
  if (feature.type === "box") {
    const { width, height, depth, cornerRadius = 0 } = feature.parameters;
    if (cornerRadius > 0) {
      return new RoundedBoxGeometry(
        width,
        height,
        depth,
        4,
        Math.min(cornerRadius, width / 2, height / 2, depth / 2),
      );
    }
    return new THREE.BoxGeometry(width, height, depth);
  }
  if (feature.type === "cylinder") {
    return new THREE.CylinderGeometry(feature.parameters.radius, feature.parameters.radius, feature.parameters.height, 32);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(feature.parameters.positions, 3));
  if (feature.parameters.indices.length > 0) geometry.setIndex(feature.parameters.indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createPacketRow(feature: ModelFeature) {
  if (feature.type !== "box") return null;
  const count = 7;
  const width = feature.parameters.width;
  const height = feature.parameters.height;
  const depth = feature.parameters.depth;
  const packetWidth = width / (count + 1.8);
  const geometry = new RoundedBoxGeometry(packetWidth, height, depth, 3, Math.min(12, packetWidth * 0.15));
  const material = materialFor(feature);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const palette = ["#F08B4A", "#F4C45A", "#80C7B5", "#EA6F72", "#9CA7ED", "#B8F13C", "#F0A1CA"];
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  for (let index = 0; index < count; index += 1) {
    const x = -width / 2 + packetWidth * 0.9 + index * ((width - packetWidth * 1.8) / (count - 1));
    matrix.makeTranslation(x, 0, 0);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color.set(palette[index]!));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.position.set(...feature.position);
  mesh.rotation.set(...feature.rotation.map((value) => THREE.MathUtils.degToRad(value)) as Vector3Tuple);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = feature.id;
  return mesh;
}

function createFeatureObject(feature: ModelFeature) {
  if (packetRows.has(feature.id)) return createPacketRow(feature);
  const mesh = new THREE.Mesh(geometryFor(feature), materialFor(feature));
  mesh.position.set(...feature.position);
  mesh.rotation.set(...feature.rotation.map((value) => THREE.MathUtils.degToRad(value)) as Vector3Tuple);
  mesh.castShadow = feature.appearance?.material !== "glass";
  mesh.receiveShadow = true;
  mesh.name = feature.id;
  return mesh;
}

function disposeGroup(group: THREE.Group) {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

function marker(color: number, position: Vector3Tuple) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(42, 7, 10, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }),
  );
  ring.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(13, 18, 18),
    new THREE.MeshBasicMaterial({ color }),
  );
  group.add(ring, core);
  group.position.set(...position);
  return group;
}

export class SnackCabinetPreviewScene {
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 1, 12000);
  private readonly controls: OrbitControls;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly canvas: HTMLCanvasElement;
  private readonly root: HTMLElement;
  private readonly clock = new THREE.Clock();
  private modelRoot = new THREE.Group();
  private pickupFlapPivot: THREE.Group | null = null;
  private pickupOpen = false;
  private pickupAngle = 0;
  private pickupTargetAngle = 0;
  private device: ModelAssetDeviceClass = "desktop";
  private parameters: SnackCabinetParameters = { ...defaultSnackCabinetParameters };

  constructor(root: HTMLElement, canvas: HTMLCanvasElement) {
    this.root = root;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 1500;
    this.controls.maxDistance = 5200;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this.scene.fog = new THREE.FogExp2(0x080e11, 0.00024);
    this.scene.add(new THREE.HemisphereLight(0xd5f8f1, 0x10191d, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.8);
    keyLight.position.set(2300, 3300, 2500);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -1800;
    keyLight.shadow.camera.right = 1800;
    keyLight.shadow.camera.top = 2600;
    keyLight.shadow.camera.bottom = -800;
    this.scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x7ee6d9, 2.8);
    rimLight.position.set(-2200, 1700, -1500);
    this.scene.add(rimLight);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3300, 96),
      new THREE.MeshStandardMaterial({ color: 0x10191d, roughness: 0.9, metalness: 0.08 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const grid = new THREE.GridHelper(6600, 44, 0x416466, 0x23383b);
    grid.position.y = 0.5;
    this.scene.add(grid);
    this.scene.add(this.modelRoot);

    this.renderer.setAnimationLoop(() => this.renderFrame());
    window.addEventListener("resize", this.resize);
    this.resize();
    this.rebuild(this.parameters, this.device);
  }

  rebuild(parameters: SnackCabinetParameters, device: ModelAssetDeviceClass) {
    this.parameters = parameters;
    this.device = device;
    disposeGroup(this.modelRoot);
    this.scene.remove(this.modelRoot);
    this.modelRoot = new THREE.Group();
    this.pickupFlapPivot = null;

    const model = createSnackCabinet(parameters);
    const graph = model.featureGraph!;
    const level = snackCabinetManifest.lod.find((profile) => profile.device === device)!.levels[0]!;
    const visibleIds = new Set(level.featureIds ?? graph.features.map((feature) => feature.id));
    const joint = graph.joints?.find((entry) => entry.id === snackCabinetJointIds.pickupFlap);

    for (const feature of graph.features) {
      if (!visibleIds.has(feature.id)) continue;
      const object = createFeatureObject(feature);
      if (!object) continue;
      if (feature.id === snackCabinetFeatureIds.pickupFlap && joint) {
        const pivot = new THREE.Group();
        pivot.position.set(...joint.pivot);
        object.position.sub(new THREE.Vector3(...joint.pivot));
        pivot.add(object);
        this.modelRoot.add(pivot);
        this.pickupFlapPivot = pivot;
      } else {
        this.modelRoot.add(object);
      }
    }

    const anchors = snackCabinetManifest.anchors;
    const pickup = anchors.find((anchor) => anchor.id === "snack-cabinet-pickup-item")!;
    const select = anchors.find((anchor) => anchor.id === "snack-cabinet-select-item")!;
    const refill = anchors.find((anchor) => anchor.id === "snack-cabinet-refill-stock")!;
    this.modelRoot.add(marker(0xf1ae62, pickup.position), marker(0xb8f13c, select.position), marker(0x72a9f0, refill.position));
    this.scene.add(this.modelRoot);
    this.setPickupOpen(this.pickupOpen);
    this.applyCameraPreset();
  }

  setPickupOpen(open: boolean) {
    this.pickupOpen = open;
    this.pickupTargetAngle = THREE.MathUtils.degToRad(open ? 52 : 0);
  }

  dispose() {
    window.removeEventListener("resize", this.resize);
    this.renderer.setAnimationLoop(null);
    disposeGroup(this.modelRoot);
    this.controls.dispose();
    this.renderer.dispose();
  }

  private applyCameraPreset() {
    const preview = snackCabinetManifest.previews.find((entry) => entry.device === this.device)!;
    this.camera.position.set(...preview.cameraPosition);
    this.controls.target.set(...preview.cameraTarget);
    this.controls.update();
  }

  private resize = () => {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  };

  private renderFrame() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.pickupAngle = THREE.MathUtils.damp(
      this.pickupAngle,
      this.pickupTargetAngle,
      9,
      delta,
    );
    if (this.pickupFlapPivot) this.pickupFlapPivot.rotation.x = this.pickupAngle;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
