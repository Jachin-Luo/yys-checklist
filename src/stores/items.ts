import { create } from 'zustand';
import { api, type DataScope } from '../api';
import type { Item, ItemDraft, ItemOverrides, Meta } from '../api/types';
import { mergeItems } from '../domain/merge';
import { activeItems } from '../domain/reset';
import { useSessionStore } from './session';

/**
 * 主数据条目 + 覆盖层（设计文档 §7.3）。
 * 落盘键：`yys:ovr:{profileId}`；写入时机：增删条目 / 拖排序。
 *
 * 写路径策略：
 *   - `saveOrder` 走**乐观更新**（▲▼ 可能被连点，150ms 的写延迟会显得粘手）；
 *   - 增删 / 隐藏 / 恢复走「写入成功 → `reloadItems()` 重新合并」（操作频率低，优先保证正确性）。
 *
 * `presetItems` 是**完整预设条目池**（含已被隐藏的）：条目管理页要用它列出"已隐藏的预设条目"，
 * 而 `items`（有效条目）里这些已经被过滤掉了。
 */
interface ItemState {
  meta: Meta | null;
  /** 有效条目 = 种子 − 已隐藏 + 自建，且已过滤 `until` 过期项 */
  items: Item[];
  /** 完整预设条目池（只读主数据，含已隐藏项） */
  presetItems: Item[];
  overrides: ItemOverrides | null;
  error: Error | null;
  applyBootstrap: (payload: { meta: Meta; items: Item[]; overrides: ItemOverrides }) => void;
  reloadItems: () => Promise<void>;
  /** 懒加载完整预设池（首屏 bootstrap 不返回它） */
  loadPreset: () => Promise<void>;
  addItem: (draft: ItemDraft) => Promise<Item | null>;
  hideItem: (itemId: string) => Promise<void>;
  restoreItem: (itemId: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  saveOrder: (order: string[]) => Promise<void>;
  resetLibrary: () => Promise<void>;
}

function scopeOf(): DataScope | null {
  const { session } = useSessionStore.getState();
  return session ? { userId: session.userId, profileId: session.profileId } : null;
}

export const useItemStore = create<ItemState>((set, get) => {
  /** 变更后重新拉取并合并：`listItems()` 给的是完整种子，合并规则在 domain/merge */
  const reload = async () => {
    const scope = scopeOf();
    if (!scope) return;
    try {
      const [seed, ov] = await Promise.all([api.listItems(), api.getOverrides(scope)]);
      set({
        presetItems: seed,
        items: activeItems(mergeItems(seed, ov), new Date()),
        overrides: ov,
        error: null,
      });
    } catch (e) {
      console.error('[items] 重新拉取失败', e);
      set({ error: e as Error });
    }
  };

  const mutate = async (task: (scope: DataScope) => Promise<unknown>) => {
    const scope = scopeOf();
    if (!scope) return;
    try {
      await task(scope);
      await reload();
    } catch (e) {
      console.error('[items] 写入失败', e);
      set({ error: e as Error });
    }
  };

  return {
    meta: null,
    items: [],
    presetItems: [],
    overrides: null,
    error: null,

    applyBootstrap: ({ meta, items, overrides }) => set({ meta, items, overrides, error: null }),

    reloadItems: reload,

    loadPreset: async () => {
      if (get().presetItems.length) return;
      try {
        set({ presetItems: await api.listItems() });
      } catch (e) {
        console.error('[items] 预设池加载失败', e);
        set({ error: e as Error });
      }
    },

    addItem: async (draft) => {
      const scope = scopeOf();
      if (!scope) return null;
      try {
        const item = await api.addCustomItem(scope, draft);
        await reload();
        return item;
      } catch (e) {
        console.error('[items] 新建条目失败', e);
        set({ error: e as Error });
        return null;
      }
    },

    hideItem: (itemId) => mutate((scope) => api.hideItem(scope, itemId)),

    restoreItem: (itemId) => mutate((scope) => api.restoreItem(scope, itemId)),

    removeItem: (itemId) => mutate((scope) => api.removeCustomItem(scope, itemId)),

    saveOrder: async (order) => {
      const scope = scopeOf();
      const prev = get().overrides;
      if (!scope || !prev) return;
      /* 乐观更新：顺序本身就存在这层，先改本地再落盘 */
      set({ overrides: { ...prev, order }, error: null });
      try {
        await api.saveOrder(scope, order);
      } catch (e) {
        console.error('[items] 保存顺序失败，回滚', e);
        set({ overrides: prev, error: e as Error });
      }
    },

    resetLibrary: () => mutate((scope) => api.resetItemLibrary(scope)),
  };
});

/**
 * 切号时清空内存态（由 `useBootstrap` 在 scope 变化时调用）。
 * 不清的话，新档案的首屏聚合返回前会短暂显示**旧档案**的条目与自建项。
 */
export const resetItemsMemory = (): void =>
  useItemStore.setState({ items: [], presetItems: [], overrides: null, error: null });

/** 字典按 type 建索引（避免组件里反复 filter） */
export const dictIndexOf = (meta: Meta | null, type: string) => {
  const map = new Map<string, { label: string; sort: number; note?: string }>();
  if (meta) {
    for (const d of meta.dicts) {
      if (d.type === type) map.set(d.code, { label: d.label, sort: d.sort, note: d.note });
    }
  }
  return map;
};
