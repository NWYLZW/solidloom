export class RuntimeArchiveMigrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly packageId?: string,
  ) {
    super(message);
    this.name = "RuntimeArchiveMigrationError";
  }
}

export class RuntimeMigrationHandlerMissingError extends RuntimeArchiveMigrationError {
  constructor(packageId: string, migrationId: string) {
    super(
      "migration-handler-missing",
      `领域包 ${packageId} 的迁移 ${migrationId} 没有可执行处理器，拒绝静默升级存档。`,
      packageId,
    );
    this.name = "RuntimeMigrationHandlerMissingError";
  }
}
