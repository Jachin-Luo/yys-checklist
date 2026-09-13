/**
 * 单测用的 localStorage 垫片。
 * vitest 跑在 node 环境（无 window），而持久化层按 `window.localStorage` 取用；
 * 这里装一个内存实现，并记录每一次 `setItem`，用于断言「只写哪个分片」。
 */
export class MemoryStorage {
  private map = new Map<string, string>();

  /** 按顺序记录被写过的 key（分片写入验证的核心断言对象） */
  readonly written: string[] = [];

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
    this.written.push(key);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
    this.written.length = 0;
  }
}

export function installMemoryStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
  return storage;
}
