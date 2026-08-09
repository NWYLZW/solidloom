export type OfficeExistingAssetKey =
  | "desk"
  | "chair"
  | "laptop"
  | "monitor"
  | "tower"
  | "avatar";

export interface OfficeAssetLodPerformanceBudget {
  levelId: string;
  maximumDrawCalls: number;
  triangleBudget: number;
}

export interface OfficeAssetPerformanceBudget {
  desktop: OfficeAssetLodPerformanceBudget[];
  mobile: OfficeAssetLodPerformanceBudget[];
}
