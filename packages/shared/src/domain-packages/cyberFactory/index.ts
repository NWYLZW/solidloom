import {
  createBlockAvatar,
  createChair,
  createCoffeeMachine,
  createDesk,
  createFigure,
  createLaptop,
  createLoungeKit,
  createMonitor,
  createRoom,
  createSnackCabinet,
  createTower,
  createWaterDispenserModel,
} from "../../models/cyberFactory/index.js";
import {
  defineFactoryModelModule,
  instantiateModelModules,
} from "../../models/registry.js";
import { defineDomainPackage } from "../registry.js";

export const cyberFactoryModelModules = [
  defineFactoryModelModule({ id: "cyber-factory-desk", status: "available", createModel: createDesk }),
  defineFactoryModelModule({ id: "cyber-factory-monitor", status: "available", createModel: createMonitor }),
  defineFactoryModelModule({ id: "cyber-factory-tower", status: "available", createModel: createTower }),
  defineFactoryModelModule({ id: "cyber-factory-laptop", status: "available", createModel: createLaptop }),
  defineFactoryModelModule({ id: "cyber-factory-room", status: "available", createModel: createRoom }),
  defineFactoryModelModule({ id: "cyber-factory-chair", status: "available", createModel: createChair }),
  defineFactoryModelModule({ id: "cyber-factory-figure", status: "available", createModel: createFigure }),
  defineFactoryModelModule({ id: "solidloom-block-avatar", status: "available", createModel: createBlockAvatar }),
  defineFactoryModelModule({ id: "cyber-factory-snack-cabinet", status: "available", createModel: createSnackCabinet }),
  defineFactoryModelModule({ id: "cyber-factory-coffee-machine", status: "available", createModel: createCoffeeMachine }),
  defineFactoryModelModule({ id: "water-dispenser", status: "available", createModel: createWaterDispenserModel }),
  defineFactoryModelModule({ id: "cyber-factory-lounge-kit", status: "available", createModel: createLoungeKit }),
];

export const cyberFactoryDomainPackage = defineDomainPackage({
  schemaVersion: 1,
  id: "cyber-factory",
  namespace: "cyber-factory",
  displayName: "赛博工厂",
  description: "SolidLoom 自带的参数化办公资产与场景示例。",
  version: "1.0.0",
  dataVersion: "1.0.0",
  status: "available",
  platformVersion: "^0.1.0",
  dependencies: [],
  extends: [],
  definitions: {
    entityTypes: [],
    componentTypes: [],
    relationTypes: [],
    resourceTypes: [],
    metricTypes: [],
    actionTypes: [],
    processTypes: [],
    ruleSets: [],
    viewDefinitions: [],
  },
  migrations: [],
}, {
  models: cyberFactoryModelModules,
  capabilities: [],
  uiExtensions: [],
});

export const cyberFactoryModels = instantiateModelModules(cyberFactoryModelModules);
