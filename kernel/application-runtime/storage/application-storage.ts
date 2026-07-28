/**
 * @kernel/application-runtime/storage — application storage abstraction.
 *
 * A port the host application layer implements. The kernel records the storage
 * configuration; it does NOT persist application data in M4 (no Prisma, no DB).
 * This port lets future milestones plug in per-application storage backends.
 */

export interface ApplicationStorageConfig {
  readonly applicationId: string;
  readonly kind: "in-memory" | "postgres" | "sqlite" | "object-store";
  readonly connectionRef?: string;
  readonly encrypted: boolean;
}

export interface ApplicationStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

/** In-memory storage (for self-test / inspector only). */
export class InMemoryApplicationStorage implements ApplicationStorage {
  private readonly data = new Map<string, unknown>();
  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }
  async put<T = unknown>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}
