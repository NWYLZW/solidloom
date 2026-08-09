import type { DomainPackageMigrationDeclaration } from "@solidloom/shared";
import { RuntimeArchiveMigrationError, RuntimeMigrationHandlerMissingError } from "./errors.js";
import type { RuntimeMigrationHandler, RuntimeMigrationRegistration } from "./types.js";

function registryKey(packageId: string, migrationId: string): string {
  return `${packageId}:${migrationId}`;
}

export class RuntimeMigrationRegistry {
  readonly #registrations = new Map<string, RuntimeMigrationRegistration>();

  register(registration: RuntimeMigrationRegistration): this {
    const key = registryKey(registration.packageId, registration.declaration.id);
    if (this.#registrations.has(key)) {
      throw new RuntimeArchiveMigrationError(
        "duplicate-migration-handler",
        `领域包 ${registration.packageId} 的迁移 ${registration.declaration.id} 已经注册。`,
        registration.packageId,
      );
    }
    this.#registrations.set(key, Object.freeze({ ...registration }));
    return this;
  }

  require(
    packageId: string,
    declaration: DomainPackageMigrationDeclaration,
  ): RuntimeMigrationHandler {
    const registration = this.#registrations.get(registryKey(packageId, declaration.id));
    if (!registration) throw new RuntimeMigrationHandlerMissingError(packageId, declaration.id);
    const registered = registration.declaration;
    if (registered.from !== declaration.from || registered.to !== declaration.to
      || registered.entry !== declaration.entry || registered.status !== declaration.status) {
      throw new RuntimeArchiveMigrationError(
        "migration-declaration-mismatch",
        `领域包 ${packageId} 的迁移 ${declaration.id} 注册信息与 manifest 不一致。`,
        packageId,
      );
    }
    return registration.handler;
  }
}
