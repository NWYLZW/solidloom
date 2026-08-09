import type {
  RuntimeMetricDefinition,
  RuntimeResourceTypeDefinition,
} from "@solidloom/shared";
import {
  CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  cyberFactoryEntityTypeIds as entityIds,
  cyberFactoryMetricTypeIds as metricIds,
  cyberFactoryResourceTypeIds as resourceIds,
} from "./ids.js";

const resourceBase = {
  domainPackageId: CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  kind: "resource" as const,
  revision: 1,
  status: "available" as const,
};

export const cyberFactoryResourceTypes = [
  {
    ...resourceBase,
    id: resourceIds.funds,
    displayName: "资金",
    description: "组织或员工持有、预留和结算的货币资源。",
    unit: "currency",
    precision: 2,
    divisible: true,
    allowNegative: false,
    conservation: "none",
    holderEntityTypeIds: [entityIds.organization, entityIds.employee],
  },
  {
    ...resourceBase,
    id: resourceIds.inventoryUnit,
    displayName: "库存单位",
    description: "组织、场所、员工或设备持有的离散库存计数。",
    unit: "item",
    precision: 0,
    divisible: false,
    allowNegative: false,
    conservation: "closed",
    holderEntityTypeIds: [
      entityIds.organization,
      entityIds.employee,
      entityIds.place,
      entityIds.device,
    ],
  },
] as const satisfies readonly RuntimeResourceTypeDefinition[];

const metricBase = {
  domainPackageId: CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  kind: "metric" as const,
  revision: 1,
  status: "available" as const,
};

export const cyberFactoryMetricTypes = [
  {
    ...metricBase,
    id: metricIds.taskValueCreated,
    displayName: "任务创造价值",
    description: "由有效工作累计产生的经营价值。",
    mode: "counter",
    unit: "currency",
  },
  {
    ...metricBase,
    id: metricIds.taskProgress,
    displayName: "任务进度",
    description: "任务当前完成比例。",
    mode: "gauge",
    unit: "ratio",
  },
  {
    ...metricBase,
    id: metricIds.employeeUtilization,
    displayName: "员工利用率",
    description: "员工有效工作时间相对可用时间的比例。",
    mode: "gauge",
    unit: "ratio",
  },
  {
    ...metricBase,
    id: metricIds.productionThroughput,
    displayName: "生产吞吐量",
    description: "流水线累计完成的离散产出数量。",
    mode: "counter",
    unit: "item",
  },
] as const satisfies readonly RuntimeMetricDefinition[];
