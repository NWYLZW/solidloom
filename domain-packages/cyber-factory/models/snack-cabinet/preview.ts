import type { ModelAssetDeviceClass } from "@solidloom/shared";
import { SnackCabinetOperationsPanel } from "./operations-panel.js";
import { SnackCabinetPreviewScene } from "./preview-scene.js";
import {
  defaultSnackCabinetParameters,
  normalizeSnackCabinetParameters,
  type SnackCabinetFinish,
  type SnackCabinetParameters,
} from "./model.js";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`缺少预览元素：${id}`);
  return element as T;
}

const root = requiredElement<HTMLElement>("preview-root");
const canvas = requiredElement<HTMLCanvasElement>("preview-canvas");
const scene = new SnackCabinetPreviewScene(root, canvas);
const operationsPanel = new SnackCabinetOperationsPanel(requiredElement<HTMLElement>("operations-panel"));
const dimensionBadge = requiredElement<HTMLElement>("dimension-badge");
const deviceBadge = requiredElement<HTMLElement>("device-badge");
const pickupButton = requiredElement<HTMLButtonElement>("pickup-toggle");
const deviceSelect = requiredElement<HTMLSelectElement>("device");
const finishSelect = requiredElement<HTMLSelectElement>("finish");
const inputs = {
  width: requiredElement<HTMLInputElement>("width"),
  height: requiredElement<HTMLInputElement>("height"),
  depth: requiredElement<HTMLInputElement>("depth"),
};
const outputs = {
  width: requiredElement<HTMLOutputElement>("width-output"),
  height: requiredElement<HTMLOutputElement>("height-output"),
  depth: requiredElement<HTMLOutputElement>("depth-output"),
};

let parameters: SnackCabinetParameters = { ...defaultSnackCabinetParameters };
let pickupOpen = false;

function resolvedDevice(): ModelAssetDeviceClass {
  if (deviceSelect.value === "desktop" || deviceSelect.value === "mobile") return deviceSelect.value;
  return window.matchMedia("(max-width: 640px)").matches ? "mobile" : "desktop";
}

function updatePreview() {
  parameters = normalizeSnackCabinetParameters({
    width: Number(inputs.width.value),
    height: Number(inputs.height.value),
    depth: Number(inputs.depth.value),
    finish: finishSelect.value as SnackCabinetFinish,
  });
  const device = resolvedDevice();
  outputs.width.value = `${parameters.width} mm`;
  outputs.height.value = `${parameters.height} mm`;
  outputs.depth.value = `${parameters.depth} mm`;
  dimensionBadge.textContent = `${parameters.width} × ${parameters.height} × ${parameters.depth} mm`;
  deviceBadge.textContent = device === "mobile" ? "手机层级" : "桌面层级";
  scene.rebuild(parameters, device);
}

Object.values(inputs).forEach((input) => input.addEventListener("input", updatePreview));
finishSelect.addEventListener("change", updatePreview);
deviceSelect.addEventListener("change", updatePreview);
pickupButton.addEventListener("click", () => {
  pickupOpen = !pickupOpen;
  pickupButton.setAttribute("aria-pressed", String(pickupOpen));
  pickupButton.textContent = pickupOpen ? "关闭取物挡板" : "打开取物挡板";
  scene.setPickupOpen(pickupOpen);
});

window.matchMedia("(max-width: 640px)").addEventListener("change", () => {
  if (deviceSelect.value === "auto") updatePreview();
});
window.addEventListener("beforeunload", () => {
  operationsPanel.dispose();
  scene.dispose();
}, { once: true });
updatePreview();
