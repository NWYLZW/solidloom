import {
  cyberFactoryEntityTypeIds as entityIds,
  type CyberFactoryEntityTypeId,
} from "./ids.js";

export const cyberFactoryModelEntityTypeMap = {
  "cyber-factory-desk": entityIds.workstation,
  "cyber-factory-monitor": entityIds.device,
  "cyber-factory-tower": entityIds.device,
  "cyber-factory-laptop": entityIds.device,
  "cyber-factory-room": entityIds.place,
  "cyber-factory-chair": entityIds.chair,
  "cyber-factory-figure": entityIds.employee,
  "solidloom-block-avatar": entityIds.employee,
  "cyber-factory-snack-cabinet": entityIds.device,
  "cyber-factory-coffee-machine": entityIds.device,
  "water-dispenser": entityIds.device,
  "cyber-factory-lounge-kit": entityIds.place,
  "cyber-factory-warehouse-rack": entityIds.device,
  "cyber-factory-warehouse-pallet": entityIds.device,
  "cyber-factory-warehouse-tote": entityIds.device,
  "cyber-factory-warehouse-cart": entityIds.device,
  "cyber-factory-warehouse-stacker-crane": entityIds.device,
} as const satisfies Readonly<Record<string, CyberFactoryEntityTypeId>>;

export function resolveCyberFactoryEntityTypeForModel(
  modelId: string,
): CyberFactoryEntityTypeId | null {
  return (cyberFactoryModelEntityTypeMap as Readonly<Record<string, CyberFactoryEntityTypeId>>)[modelId]
    ?? null;
}
