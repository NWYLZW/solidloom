import {
  RUNTIME_QUERY_CAPABILITIES,
  type RuntimeRoleDefinition,
} from "@solidloom/shared";
import {
  CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  cyberFactoryComponentTypeIds,
  cyberFactoryEntityTypeIds,
  cyberFactoryMetricTypeIds,
  cyberFactoryRelationTypeIds,
  cyberFactoryRoleIds,
  cyberFactoryRuleSetIds,
} from "../entities/ids.js";

export interface CyberFactoryAuthorizationProfile {
  readonly id: string;
  readonly namespace: typeof CYBER_FACTORY_DOMAIN_PACKAGE_ID;
  readonly roles: readonly RuntimeRoleDefinition[];
}

const entityCapability = RUNTIME_QUERY_CAPABILITIES.entities;
const metricCapability = RUNTIME_QUERY_CAPABILITIES.metrics;

function entityDataGrant(options: {
  readonly componentTypeIds: readonly string[] | "*";
  readonly relationTypeIds: readonly string[] | "*";
}) {
  return {
    capabilityId: entityCapability,
    entities: {
      entityTypeIds: Object.values(cyberFactoryEntityTypeIds),
      entityFields: "*" as const,
      components: options.componentTypeIds === "*"
        ? "*" as const
        : options.componentTypeIds.map((componentTypeId) => ({ componentTypeId, fieldPaths: "*" as const })),
      relations: options.relationTypeIds === "*"
        ? "*" as const
        : options.relationTypeIds.map((relationTypeId) => ({ relationTypeId, attributePaths: "*" as const })),
    },
  };
}

const metricDataGrant = {
  capabilityId: metricCapability,
  metrics: { metricTypeIds: Object.values(cyberFactoryMetricTypeIds) },
} as const;

export const cyberFactoryRoles = [
  {
    id: cyberFactoryRoleIds.viewer,
    displayName: "观察者",
    status: "available",
    capabilityIds: [entityCapability, metricCapability],
    dataGrants: [
      entityDataGrant({
        componentTypeIds: [
          cyberFactoryComponentTypeIds.identity,
          cyberFactoryComponentTypeIds.lifecycleState,
          cyberFactoryComponentTypeIds.sceneBinding,
          cyberFactoryComponentTypeIds.placeProfile,
          cyberFactoryComponentTypeIds.workstationProfile,
          cyberFactoryComponentTypeIds.deviceProfile,
          cyberFactoryComponentTypeIds.taskState,
          cyberFactoryComponentTypeIds.productionLineState,
        ],
        relationTypeIds: Object.values(cyberFactoryRelationTypeIds),
      }),
      metricDataGrant,
    ],
  },
  {
    id: cyberFactoryRoleIds.operator,
    displayName: "运营人员",
    status: "available",
    capabilityIds: [entityCapability, metricCapability],
    dataGrants: [entityDataGrant({ componentTypeIds: "*", relationTypeIds: "*" }), metricDataGrant],
  },
  {
    id: cyberFactoryRoleIds.manager,
    displayName: "管理员",
    status: "available",
    capabilityIds: [entityCapability, metricCapability],
    dataGrants: [entityDataGrant({ componentTypeIds: "*", relationTypeIds: "*" }), metricDataGrant],
  },
] as const satisfies readonly RuntimeRoleDefinition[];

export const cyberFactoryAuthorizationProfile: CyberFactoryAuthorizationProfile = Object.freeze({
  id: cyberFactoryRuleSetIds.defaultAuthorization,
  namespace: CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  roles: cyberFactoryRoles,
});
