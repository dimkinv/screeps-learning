import { Role } from "./roles";
import { SimpleCreepBase, SimpleCreepConstructor } from "./simpleCreepBase";

export function RoleAndMemoryMixin<TBase extends SimpleCreepConstructor<SimpleCreepBase>>(Base: TBase) {
  return class RoleAndMemory extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * Read the creep's stored `role` from memory.
     * @returns Role value if set, otherwise `null`.
     */
    getRole(): Role | null {
      const r = this.creep.memory.role as Role | undefined;
      return r ?? null;
    }

    /**
     * Check whether the creep matches a given role.
     * @param role Target role to compare.
     */
    is(role: Role): boolean {
      return this.getRole() === role;
    }

    /**
     * Persist a new role on the creep's memory.
     * @param role Role to assign.
     */
    setRole(role: Role): void {
      this.creep.memory.role = role;
    }

    /**
     * Store a value in the creep's memory under a custom key.
     * @param key Memory key to store under.
     * @param value Arbitrary serializable value to remember.
     */
    remember<T>(key: string, value: T): void {
      (this.creep.memory as any)[key] = value as any;
    }

    /**
     * Retrieve a remembered value from the creep's memory.
     * @param key Memory key to read.
     * @returns Stored value or `undefined` if missing.
     */
    recall<T>(key: string): T | undefined {
      return (this.creep.memory as any)[key] as T | undefined;
    }

    /**
     * Log a status message prefixed with creep name and role for easy debugging.
     * @param message Message to print.
     */
    logStatus(message: string): void {
      const roleLabel = this.getRole() ?? "unknown";
      console.log(`[${this.creep.name}|${roleLabel}] ${message}`);
    }
  };
}

export type RoleAndMemory = InstanceType<ReturnType<typeof RoleAndMemoryMixin>>;
