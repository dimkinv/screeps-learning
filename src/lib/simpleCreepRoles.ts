import { Role } from "./roles";
import { SimpleCreepBase, SimpleCreepConstructor } from "./simpleCreepBase";

export function RoleAndMemoryMixin<TBase extends SimpleCreepConstructor<SimpleCreepBase>>(Base: TBase) {
  return class RoleAndMemory extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * Читает сохранённую роль крипа из памяти.
     * @returns Значение роли или `null`, если не задано.
     */
    getRole(): Role | null {
      const r = this.creep.memory.role as Role | undefined;
      return r ?? null;
    }

    /**
     * Проверяет, соответствует ли крип указанной роли.
     * @param role Целевая роль для сравнения.
     */
    is(role: Role): boolean {
      return this.getRole() === role;
    }

    /**
     * Записывает новую роль в память крипа.
     * @param role Роль для назначения.
     */
    setRole(role: Role): void {
      this.creep.memory.role = role;
    }

    /**
     * Сохраняет значение в памяти крипа по указанному ключу.
     * @param key Ключ памяти для сохранения.
     * @param value Любое сериализуемое значение.
     */
    remember<T>(key: string, value: T): void {
      (this.creep.memory as any)[key] = value as any;
    }

    /**
     * Извлекает сохранённое значение из памяти крипа.
     * @param key Ключ памяти.
     * @returns Сохранённое значение или `undefined`, если его нет.
     */
    recall<T>(key: string): T | undefined {
      return (this.creep.memory as any)[key] as T | undefined;
    }

    /**
     * Логирует сообщение с именем крипа и его ролью для удобной отладки.
     * @param message Сообщение для вывода.
     */
    logStatus(message: string): void {
      const roleLabel = this.getRole() ?? "unknown";
      console.log(`[${this.creep.name}|${roleLabel}] ${message}`);
    }
  };
}

export type RoleAndMemory = InstanceType<ReturnType<typeof RoleAndMemoryMixin>>;
