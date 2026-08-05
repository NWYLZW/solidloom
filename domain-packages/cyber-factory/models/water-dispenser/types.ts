export type WaterDispenserQuality = "desktop" | "mobile";

export interface WaterDispenserParameters {
  width: number;
  depth: number;
  bodyHeight: number;
  tankRadius: number;
  tankHeight: number;
  nozzleSpacing: number;
}
