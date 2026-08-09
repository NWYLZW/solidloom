import type { RuntimeEntityTypeDefinition } from "@solidloom/shared";
import {
  CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  cyberFactoryComponentTypeIds as componentIds,
  cyberFactoryEntityTypeIds as entityIds,
} from "./ids.js";

const definitionBase = {
  domainPackageId: CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  kind: "entity" as const,
  revision: 1,
  status: "available" as const,
};

const commonComponents = [
  componentIds.identity,
  componentIds.lifecycleState,
] as const;

export const cyberFactoryEntityTypes = [
  {
    ...definitionBase,
    id: entityIds.organization,
    displayName: "组织",
    description: "持有员工、场所、资产、任务和经营资源的组织主体。",
    componentTypeIds: [...commonComponents, componentIds.organizationProfile],
  },
  {
    ...definitionBase,
    id: entityIds.employee,
    displayName: "员工",
    description: "可被分配任务、占用工位并拥有状态的行动主体。",
    componentTypeIds: [
      ...commonComponents,
      componentIds.sceneBinding,
      componentIds.employeeProfile,
      componentIds.employeeNeeds,
    ],
  },
  {
    ...definitionBase,
    id: entityIds.place,
    displayName: "场所",
    description: "容纳工位、设备和流水线的办公或生产空间。",
    componentTypeIds: [...commonComponents, componentIds.sceneBinding, componentIds.placeProfile],
  },
  {
    ...definitionBase,
    id: entityIds.workstation,
    displayName: "工位",
    description: "员工执行任务时可以被分配和占用的工作位置。",
    componentTypeIds: [...commonComponents, componentIds.sceneBinding, componentIds.workstationProfile],
  },
  {
    ...definitionBase,
    id: entityIds.chair,
    displayName: "椅子",
    description: "可以被员工占用、移动并归属于场所或组织的座椅。",
    componentTypeIds: [...commonComponents, componentIds.sceneBinding],
  },
  {
    ...definitionBase,
    id: entityIds.device,
    displayName: "设备",
    description: "电脑、饮水机、售货机和生产设备等可交互资产。",
    componentTypeIds: [...commonComponents, componentIds.sceneBinding, componentIds.deviceProfile],
  },
  {
    ...definitionBase,
    id: entityIds.task,
    displayName: "任务",
    description: "具有进度、价值和生命周期的工作目标。",
    componentTypeIds: [...commonComponents, componentIds.taskState],
  },
  {
    ...definitionBase,
    id: entityIds.productionLine,
    displayName: "流水线",
    description: "组合工位和设备并持续产生加工结果的生产单元。",
    componentTypeIds: [
      ...commonComponents,
      componentIds.sceneBinding,
      componentIds.productionLineState,
    ],
  },
] as const satisfies readonly RuntimeEntityTypeDefinition[];
