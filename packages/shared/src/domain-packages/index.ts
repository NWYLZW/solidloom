import { createDomainPackageRegistry } from "./registry.js";
import { cyberFactoryDomainPackage } from "./cyberFactory/index.js";

export * from "./cyberFactory/index.js";
export * from "./errors.js";
export * from "./manifest.js";
export * from "./migrations.js";
export * from "./registry.js";
export * from "./types.js";
export * from "./version.js";

export const builtInDomainPackages = [cyberFactoryDomainPackage];
export const builtInDomainRegistry = createDomainPackageRegistry(builtInDomainPackages);
