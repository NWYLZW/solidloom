export type DomainPackageErrorCode =
  | "manifest-invalid"
  | "namespace-conflict"
  | "definition-conflict"
  | "platform-incompatible"
  | "dependency-missing"
  | "dependency-incompatible"
  | "dependency-cycle"
  | "extension-missing"
  | "migration-not-ready";

export class DomainPackageContractError extends Error {
  readonly code: DomainPackageErrorCode;
  readonly packageId: string | undefined;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: DomainPackageErrorCode,
    message: string,
    options: {
      packageId?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = "DomainPackageContractError";
    this.code = code;
    this.packageId = options.packageId;
    this.details = Object.freeze({ ...options.details });
  }
}

export class DomainPackageManifestValidationError extends DomainPackageContractError {
  readonly issues: readonly string[];

  constructor(packageId: string | undefined, issues: readonly string[]) {
    super(
      "manifest-invalid",
      `领域包${packageId ? ` ${packageId}` : ""} manifest 无效：${issues.join("；")}`,
      {
        ...(packageId === undefined ? {} : { packageId }),
        details: { issues: [...issues] },
      },
    );
    this.name = "DomainPackageManifestValidationError";
    this.issues = Object.freeze([...issues]);
  }
}
