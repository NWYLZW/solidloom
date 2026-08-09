import type { RuntimeRelationTypeDefinition } from "@solidloom/shared";
import {
  CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  cyberFactoryEntityTypeIds as entityIds,
  cyberFactoryRelationTypeIds as relationIds,
} from "../entities/ids.js";

const definitionBase = {
  domainPackageId: CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  kind: "relation" as const,
  revision: 1,
  status: "available" as const,
  direction: "directed" as const,
  symmetric: false,
  transitive: false,
  uniquePair: true,
};

const emptyAttributesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const;

export const cyberFactoryRelationTypes = [
  {
    ...definitionBase,
    id: relationIds.employedBy,
    displayName: "受雇于",
    description: "员工与雇佣组织之间的有效归属关系。",
    sourceCardinality: "one",
    targetCardinality: "many",
    sourceEntityTypeIds: [entityIds.employee],
    targetEntityTypeIds: [entityIds.organization],
    attributesSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        startedAt: { type: "string", format: "date-time" },
        title: { type: "string", maxLength: 120 },
      },
    },
  },
  {
    ...definitionBase,
    id: relationIds.assignedTo,
    displayName: "分配至",
    description: "员工被分配到任务、工位或流水线，可附带职责与投入比例。",
    sourceCardinality: "many",
    targetCardinality: "many",
    sourceEntityTypeIds: [entityIds.employee],
    targetEntityTypeIds: [entityIds.task, entityIds.workstation, entityIds.productionLine],
    attributesSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        role: { type: "string", maxLength: 120 },
        allocation: { type: "number", minimum: 0, maximum: 1 },
      },
    },
  },
  {
    ...definitionBase,
    id: relationIds.occupies,
    displayName: "占用",
    description: "员工当前占用工位或座椅的互斥关系。",
    sourceCardinality: "one",
    targetCardinality: "one",
    sourceEntityTypeIds: [entityIds.employee],
    targetEntityTypeIds: [entityIds.workstation, entityIds.chair],
    attributesSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        since: { type: "string", format: "date-time" },
      },
    },
  },
  {
    ...definitionBase,
    id: relationIds.belongsTo,
    displayName: "归属于",
    description: "场所、资产、任务与生产单元归属于一个组织。",
    sourceCardinality: "one",
    targetCardinality: "many",
    sourceEntityTypeIds: [
      entityIds.place,
      entityIds.workstation,
      entityIds.chair,
      entityIds.device,
      entityIds.task,
      entityIds.productionLine,
    ],
    targetEntityTypeIds: [entityIds.organization],
    attributesSchema: emptyAttributesSchema,
  },
  {
    ...definitionBase,
    id: relationIds.locatedIn,
    displayName: "位于",
    description: "工位、座椅、设备或流水线在场所中的结构化位置关系。",
    sourceCardinality: "one",
    targetCardinality: "many",
    sourceEntityTypeIds: [
      entityIds.workstation,
      entityIds.chair,
      entityIds.device,
      entityIds.productionLine,
    ],
    targetEntityTypeIds: [entityIds.place],
    attributesSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        zone: { type: "string", maxLength: 120 },
      },
    },
  },
] as const satisfies readonly RuntimeRelationTypeDefinition[];
