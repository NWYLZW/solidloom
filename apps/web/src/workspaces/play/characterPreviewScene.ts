import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createNavigationAvatar, type NavigationAvatarSkin } from "../../navigationAvatar";

interface CharacterPreviewSceneOptions {
  canvas: HTMLCanvasElement;
  onTextureReady?: () => void;
  preserveDrawingBuffer?: boolean;
  skin: NavigationAvatarSkin;
}

export interface CharacterPreviewScene {
  dispose: (forceContextLoss?: boolean) => void;
  render: () => void;
  resize: (width: number, height: number) => void;
  renderer: THREE.WebGLRenderer;
}

export function createCharacterPreviewScene({
  canvas,
  onTextureReady,
  preserveDrawingBuffer = false,
  skin,
}: CharacterPreviewSceneOptions): CharacterPreviewScene {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    preserveDrawingBuffer,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(-2.8, 3.15, 4.4);
  camera.lookAt(0, 0.72, 0);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3.2;
  controls.maxDistance = 7.2;
  controls.minPolarAngle = 0.28;
  controls.maxPolarAngle = Math.PI * 0.56;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.8;
  controls.target.set(0, 0.84, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xf7f8ee, 0x59615b, 2.4));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(-3, 5, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 12;
  keyLight.shadow.camera.left = -3;
  keyLight.shadow.camera.right = 3;
  keyLight.shadow.camera.top = 4;
  keyLight.shadow.camera.bottom = -2;
  scene.add(keyLight);

  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xd7d8d0, roughness: 0.94 });
  const floorGeometry = new THREE.PlaneGeometry(6, 6);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  scene.add(floor);

  let disposed = false;
  let renderWhenReady: () => void = () => {};
  const avatar = createNavigationAvatar({
    agentHeight: 2,
    onTextureReady: () => {
      renderWhenReady();
      onTextureReady?.();
    },
    skin,
  });
  avatar.object.position.y = 1;
  avatar.object.rotation.y = -0.08;
  scene.add(avatar.object);

  const render = () => {
    if (!disposed) {
      controls.update();
      renderer.render(scene, camera);
    }
  };
  renderWhenReady = render;

  return {
    dispose: (forceContextLoss = false) => {
      disposed = true;
      controls.dispose();
      scene.remove(avatar.object);
      avatar.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
      renderer.dispose();
      if (forceContextLoss) renderer.forceContextLoss();
    },
    render,
    renderer,
    resize: (width, height) => {
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
      camera.aspect = Math.max(1, width) / Math.max(1, height);
      camera.updateProjectionMatrix();
      render();
    },
  };
}
