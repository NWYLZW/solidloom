export interface RegistryEntry {
  id: string;
}

export class DuplicateRegistrationError extends Error {
  readonly registryName: string;
  readonly entryId: string;

  constructor(registryName: string, entryId: string) {
    super(`${registryName} 中存在重复 ID：${entryId}`);
    this.name = "DuplicateRegistrationError";
    this.registryName = registryName;
    this.entryId = entryId;
  }
}

export interface RegistrationRegistry<T extends RegistryEntry> {
  readonly name: string;
  get(id: string): T | undefined;
  has(id: string): boolean;
  ids(): string[];
  list(): T[];
}

export function createRegistrationRegistry<T extends RegistryEntry>(
  name: string,
  entries: Iterable<T>,
): RegistrationRegistry<T> {
  const byId = new Map<string, T>();
  for (const entry of entries) {
    if (byId.has(entry.id)) throw new DuplicateRegistrationError(name, entry.id);
    byId.set(entry.id, entry);
  }
  return Object.freeze({
    name,
    get: (id: string) => byId.get(id),
    has: (id: string) => byId.has(id),
    ids: () => [...byId.keys()],
    list: () => [...byId.values()],
  });
}
