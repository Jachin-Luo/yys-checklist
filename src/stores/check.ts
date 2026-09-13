import { create } from 'zustand';
import { api } from '../api';
import type { DataScope } from '../api/contract';
import { mergeChecked } from '../domain/reset';
import { useItemStore } from './items';
import { useSessionStore } from './session';

/**
 * 勾选状态（设计文档 §7.3 / E-02）。
 * 落盘键：`yys:state:{profileId}`；**每次勾选走增量 `setChecked`**，不做整表 save。
 * 乐观更新：先改本地，失败回滚并提示。
 */
interface CheckState {
  checked: Record<string, number>;
  loading: boolean;
  error: Error | null;
  applyChecked: (checked: Record<string, number>) => void;
  toggle: (itemId: string) => Promise<void>;
  /** 批量乐观更新；逐条提交，仅回滚未保存项，保留已经成功的记录 */
  setMany: (ids: string[], at: number | null) => Promise<void>;
  /** 一键日常入口的双向级联：已勾 → 全部取消；未勾 → 全部勾选（同一时间戳） */
  toggleWithCascade: (hubId: string, coveredIds: string[]) => Promise<void>;
  clearAll: () => Promise<void>;
}

interface CheckMutation {
  /** null clears the entire shard; an array changes only those items. */
  ids: string[] | null;
  at: number | null;
}

let generation = 0;
let saved: Record<string, number> = {};
let pending: CheckMutation[] = [];
let writeQueue: Promise<void> = Promise.resolve();

function resetTracking(checked: Record<string, number>): void {
  generation += 1;
  saved = checked;
  pending = [];
}

function isCurrentScope(scope: DataScope): boolean {
  const session = useSessionStore.getState().session;
  return session?.userId === scope.userId && session.profileId === scope.profileId;
}

function currentPeriod(checked: Record<string, number>): Record<string, number> {
  const { meta, items } = useItemStore.getState();
  return meta ? mergeChecked(checked, items, new Date(), meta) : checked;
}

/** 在本地 checked 上批量套用，用于乐观更新与回滚 */
function applyMany(
  prev: Record<string, number>,
  ids: readonly string[],
  at: number | null,
): Record<string, number> {
  const next = { ...prev };
  for (const id of ids) {
    if (at === null) delete next[id];
    else next[id] = at;
  }
  return next;
}

function applyMutation(
  checked: Record<string, number>,
  mutation: CheckMutation,
): Record<string, number> {
  return mutation.ids === null ? {} : applyMany(checked, mutation.ids, mutation.at);
}

export const useCheckStore = create<CheckState>((set, get) => {
  const persist = async (mutation: CheckMutation) => {
    const { session } = useSessionStore.getState();
    if (!session) return;
    const scope = { userId: session.userId, profileId: session.profileId };
    const startedIn = generation;
    if (!pending.length) saved = get().checked;
    pending.push(mutation);
    set({ checked: applyMutation(get().checked, mutation), error: null });

    // Preserve request order while keeping every click immediately visible.
    const run = writeQueue.then(async () => {
      const results = mutation.ids === null
        ? await Promise.allSettled([Promise.resolve().then(() => api.clearAllChecked(scope))])
        : await Promise.allSettled(
          mutation.ids.map(async (id) => api.setChecked(scope, id, mutation.at)),
        );
      if (generation !== startedIn || !isCurrentScope(scope)) return;

      let error: Error | null = null;
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          error ??= result.reason instanceof Error ? result.reason : new Error(String(result.reason));
        } else {
          saved = mutation.ids === null ? {} : applyMany(saved, [mutation.ids[index]], mutation.at);
        }
      });

      // Rebase later clicks on confirmed writes, never on a failed optimistic snapshot.
      pending = pending.filter((entry) => entry !== mutation);
      const checked = pending.reduce(applyMutation, saved);
      if (error) console.error('[check] 写入失败，回滚未保存项', error);
      set({ checked: currentPeriod(checked), ...(error ? { error } : {}) });
    });
    writeQueue = run.catch(() => undefined);
    await run;
  };

  return {
    checked: {},
    loading: false,
    error: null,

    applyChecked: (checked) => {
      resetTracking(checked);
      set({ checked, error: null });
    },

    toggle: async (itemId) => {
      const prev = get().checked[itemId];
      await get().setMany([itemId], prev === undefined ? Date.now() : null);
    },

    setMany: async (ids, at) => {
      if (ids.length) await persist({ ids: [...new Set(ids)], at });
    },

    toggleWithCascade: async (hubId, coveredIds) => {
      const isOn = get().checked[hubId] !== undefined;
      await get().setMany([hubId, ...coveredIds], isOn ? null : Date.now());
    },

    clearAll: () => persist({ ids: null, at: null }),
  };
});

/** 切号时清空内存态（由 `useBootstrap` 调用）。**这是最要命的一项**：
 *  勾选是用户最直接的操作结果，若旧档案的勾选在新档案下显示一帧，用户会以为漏记/误记。 */
export const resetCheckMemory = (): void => {
  resetTracking({});
  useCheckStore.setState({ checked: {}, error: null });
};

export const isChecked = (checked: Record<string, number>, itemId: string): boolean =>
  checked[itemId] !== undefined;
