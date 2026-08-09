export interface RestroomPartitionParameters {
  width: number;
  panelHeight: number;
  bottomGap: number;
  thickness: number;
}

export interface RestroomStallDoorParameters {
  openingWidth: number;
  doorHeight: number;
  bottomGap: number;
  thickness: number;
  openAngle: number;
}

export interface RestroomToiletParameters {
  bowlWidth: number;
  seatHeight: number;
  depth: number;
  tankHeight: number;
}

export interface RestroomUrinalBankParameters {
  count: number;
  centerSpacing: number;
  urinalWidth: number;
  rimHeight: number;
  projection: number;
  dividerEnabled: boolean;
  dividerDepth: number;
}

export interface RestroomVanityParameters {
  width: number;
  depth: number;
  counterHeight: number;
  basinCount: number;
  basinSpacing: number;
}

export interface RestroomMirrorParameters {
  width: number;
  height: number;
  bottomHeight: number;
  frameThickness: number;
}

export interface RestroomDoorLeafBounds {
  minimumX: number;
  maximumX: number;
  minimumZ: number;
  maximumZ: number;
}
