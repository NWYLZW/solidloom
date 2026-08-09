export const CYBER_FACTORY_DOMAIN_PACKAGE_ID = "cyber-factory" as const;

export const cyberFactoryEntityTypeIds = {
  organization: "cyber-factory.organization",
  employee: "cyber-factory.employee",
  place: "cyber-factory.place",
  workstation: "cyber-factory.workstation",
  chair: "cyber-factory.chair",
  device: "cyber-factory.device",
  task: "cyber-factory.task",
  productionLine: "cyber-factory.production-line",
} as const;

export const cyberFactoryComponentTypeIds = {
  identity: "cyber-factory.identity",
  lifecycleState: "cyber-factory.lifecycle-state",
  sceneBinding: "cyber-factory.scene-binding",
  organizationProfile: "cyber-factory.organization-profile",
  employeeProfile: "cyber-factory.employee-profile",
  employeeNeeds: "cyber-factory.employee-needs",
  placeProfile: "cyber-factory.place-profile",
  workstationProfile: "cyber-factory.workstation-profile",
  deviceProfile: "cyber-factory.device-profile",
  taskState: "cyber-factory.task-state",
  productionLineState: "cyber-factory.production-line-state",
} as const;

export const cyberFactoryResourceTypeIds = {
  funds: "cyber-factory.funds",
  inventoryUnit: "cyber-factory.inventory-unit",
} as const;

export const cyberFactoryRelationTypeIds = {
  employedBy: "cyber-factory.employed-by",
  assignedTo: "cyber-factory.assigned-to",
  occupies: "cyber-factory.occupies",
  belongsTo: "cyber-factory.belongs-to",
  locatedIn: "cyber-factory.located-in",
} as const;

export const cyberFactoryMetricTypeIds = {
  taskValueCreated: "cyber-factory.task-value-created",
  taskProgress: "cyber-factory.task-progress",
  employeeUtilization: "cyber-factory.employee-utilization",
  productionThroughput: "cyber-factory.production-throughput",
} as const;

export const cyberFactoryRuleSetIds = {
  defaultAuthorization: "cyber-factory.authorization.default",
} as const;

export const cyberFactoryRoleIds = {
  viewer: "cyber-factory.role.viewer",
  operator: "cyber-factory.role.operator",
  manager: "cyber-factory.role.manager",
} as const;

export type CyberFactoryEntityTypeId = (
  typeof cyberFactoryEntityTypeIds[keyof typeof cyberFactoryEntityTypeIds]
);
