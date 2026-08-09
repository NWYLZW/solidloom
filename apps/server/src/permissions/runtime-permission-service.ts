import type {
  RuntimeAuthorizationContext,
  RuntimeQueryPrincipal,
  RuntimeRoleDefinition,
} from "@solidloom/shared";

/**
 * Resolves declarative role definitions without exposing their persistence adapter
 * to query callers.
 */
export interface RuntimeRoleReader {
  readRoles(roleIds: readonly string[]): Promise<readonly RuntimeRoleDefinition[]>;
}

export class RuntimePermissionService {
  readonly #roles: RuntimeRoleReader;

  constructor(roles: RuntimeRoleReader) {
    this.#roles = roles;
  }

  async createAuthorizationContext(
    principal: RuntimeQueryPrincipal,
  ): Promise<RuntimeAuthorizationContext> {
    const roleIds = [...new Set(principal.assignments.map(({ roleId }) => roleId))];
    const roles = await this.#roles.readRoles(roleIds);
    const requested = new Set(roleIds);
    return {
      principal,
      roles: roles.filter((role) => requested.has(role.id)),
    };
  }
}
