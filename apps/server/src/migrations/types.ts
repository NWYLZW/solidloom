import type {
  DomainPackageMigrationDeclaration,
  RuntimeJsonValue,
} from "@solidloom/shared";

export type RuntimeMigrationSubject = "snapshot" | "event";

export interface RuntimeMigrationContext {
  readonly subject: RuntimeMigrationSubject;
  readonly runId: string;
  readonly packageId: string;
  readonly migrationId: string;
  readonly fromDataVersion: string;
  readonly toDataVersion: string;
  readonly eventType?: string;
}

export type RuntimeMigrationHandler = (
  value: RuntimeJsonValue,
  context: RuntimeMigrationContext,
) => RuntimeJsonValue;

export interface RuntimeMigrationRegistration {
  readonly packageId: string;
  readonly declaration: DomainPackageMigrationDeclaration;
  readonly handler: RuntimeMigrationHandler;
}

export type RuntimeDomainPackageVersions = Readonly<Record<string, string>>;

export interface RuntimeArchive<Value extends RuntimeJsonValue = RuntimeJsonValue> {
  readonly value: Value;
  readonly packageVersions: RuntimeDomainPackageVersions;
}
