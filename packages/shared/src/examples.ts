// 兼容入口：新模型应在自己的资产目录中注册，不再向本文件追加实现。
export { cyberFactoryModels } from "./domain-packages/cyberFactory/index.js";
export { createCyberOfficeSpaceModel, type CyberOfficeSpaceModelIds } from "./models/cyberFactory/officeSpace.js";
export { regenerateProceduralMeshFeature } from "./models/cyberFactory/procedural.js";
export { synchronizeRoomAssemblyFeatures } from "./models/cyberFactory/room.js";
