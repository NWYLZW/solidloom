import type { RuntimeComponentDefinition } from "@solidloom/shared";
import {
  CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  cyberFactoryComponentTypeIds as componentIds,
} from "./ids.js";

const definitionBase = {
  domainPackageId: CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  kind: "component" as const,
  revision: 1,
  status: "available" as const,
};

const boundedScore = {
  type: "number",
  minimum: 0,
  maximum: 100,
} as const;

export const cyberFactoryComponentTypes = [
  {
    ...definitionBase,
    id: componentIds.identity,
    displayName: "标识信息",
    description: "领域实体稳定的人类可读名称与检索标签。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "tags"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 120 },
        tags: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
      },
    },
    defaultValue: { name: "未命名实体", tags: [] },
  },
  {
    ...definitionBase,
    id: componentIds.lifecycleState,
    displayName: "生命周期状态",
    description: "实体是否可用、停用、维护或已归档的持久状态。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status"],
      properties: {
        status: { enum: ["active", "inactive", "maintenance", "archived"] },
        reason: { type: "string", maxLength: 500 },
      },
    },
    defaultValue: { status: "active" },
  },
  {
    ...definitionBase,
    id: componentIds.sceneBinding,
    displayName: "场景绑定",
    description: "把运行时实体绑定到领域拥有的模型资产或场景引用。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["modelId"],
      properties: {
        modelId: { type: "string", minLength: 1 },
        referenceId: { type: "string", minLength: 1 },
        nodeId: { type: "string", minLength: 1 },
      },
    },
  },
  {
    ...definitionBase,
    id: componentIds.organizationProfile,
    displayName: "组织资料",
    description: "公司的运营名称与本位计价单位。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["currency"],
      properties: {
        currency: { type: "string", minLength: 1, maxLength: 16 },
        registrationCode: { type: "string", maxLength: 80 },
      },
    },
    defaultValue: { currency: "CNY" },
  },
  {
    ...definitionBase,
    id: componentIds.employeeProfile,
    displayName: "员工资料",
    description: "员工岗位、技能和受雇状态，不包含平台身份字段。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["jobTitle", "skills", "employmentStatus"],
      properties: {
        jobTitle: { type: "string", minLength: 1, maxLength: 120 },
        skills: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
        employmentStatus: { enum: ["candidate", "active", "leave", "departed"] },
      },
    },
    defaultValue: { jobTitle: "成员", skills: [], employmentStatus: "active" },
  },
  {
    ...definitionBase,
    id: componentIds.employeeNeeds,
    displayName: "员工状态",
    description: "体力、水分、饱腹、压力和专注的可保存状态；变化规则由后续规则包提供。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["energy", "hydration", "satiety", "stress", "focus"],
      properties: {
        energy: boundedScore,
        hydration: boundedScore,
        satiety: boundedScore,
        stress: boundedScore,
        focus: boundedScore,
      },
    },
    defaultValue: { energy: 100, hydration: 100, satiety: 100, stress: 0, focus: 70 },
  },
  {
    ...definitionBase,
    id: componentIds.placeProfile,
    displayName: "场所资料",
    description: "办公区、休息区、仓储区等场所的用途与人数上限。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "capacity"],
      properties: {
        kind: { enum: ["office", "rest-area", "warehouse", "production-area", "service-area", "other"] },
        capacity: { type: "integer", minimum: 0 },
      },
    },
    defaultValue: { kind: "office", capacity: 0 },
  },
  {
    ...definitionBase,
    id: componentIds.workstationProfile,
    displayName: "工位资料",
    description: "工位用途、人数上限和运行状态。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "capacity", "status"],
      properties: {
        kind: { enum: ["office", "assembly", "inspection", "service", "other"] },
        capacity: { type: "integer", minimum: 1 },
        status: { enum: ["available", "reserved", "occupied", "offline"] },
      },
    },
    defaultValue: { kind: "office", capacity: 1, status: "available" },
  },
  {
    ...definitionBase,
    id: componentIds.deviceProfile,
    displayName: "设备资料",
    description: "设备类别、运行状态和可交互动作标签。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "status", "actionTags"],
      properties: {
        kind: { type: "string", minLength: 1, maxLength: 80 },
        status: { enum: ["ready", "busy", "offline", "maintenance"] },
        actionTags: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
      },
    },
    defaultValue: { kind: "generic", status: "ready", actionTags: [] },
  },
  {
    ...definitionBase,
    id: componentIds.taskState,
    displayName: "任务状态",
    description: "任务优先级、进度、价值和执行状态。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status", "priority", "progress", "value"],
      properties: {
        status: { enum: ["pending", "active", "paused", "completed", "cancelled"] },
        priority: { type: "integer", minimum: 0, maximum: 100 },
        progress: { type: "number", minimum: 0, maximum: 1 },
        value: { type: "number", minimum: 0 },
      },
    },
    defaultValue: { status: "pending", priority: 50, progress: 0, value: 0 },
  },
  {
    ...definitionBase,
    id: componentIds.productionLineState,
    displayName: "流水线状态",
    description: "流水线当前模式、处理能力和累计产量。",
    storage: "persistent",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status", "capacityPerHour", "output"],
      properties: {
        status: { enum: ["idle", "running", "paused", "blocked", "maintenance"] },
        capacityPerHour: { type: "number", minimum: 0 },
        output: { type: "number", minimum: 0 },
      },
    },
    defaultValue: { status: "idle", capacityPerHour: 0, output: 0 },
  },
] as const satisfies readonly RuntimeComponentDefinition[];
