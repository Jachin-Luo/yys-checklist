import { create } from 'zustand';
import { api } from '../api';
import type { CardDisplay, CardScope, ViewDefaults, ViewPrefs } from '../api/types';
import { defaultCardByScope, effectiveCardDisplay } from '../domain/cardDisplay';
import type { SortBy } from '../domain/enums';

import { useSessionStore } from './session';

/**
 * 视图偏好（设计文档 §7.3）。
 * 落盘键：`yys:view:{profileId}`；写入时机：改筛选 / 置顶 / 一键日常覆盖配置
 * （排序与痛感门槛已按产品决策取消写入，见下方 action 注释）。
 * 与勾选状态解耦：调视图不会丢勾选。
 */
export type CoverMode = 'dim' | 'hide';

interface ViewState {
  view: ViewPrefs;
  defaults: ViewDefaults | null;
  error: Error | null;
  applyView: (view: ViewPrefs, defaults: ViewDefaults) => void;
  /**
   * ⚠️ 已无调用方（排序控件按产品决策取消）：生效排序由 `effectiveSortBy(order)` 派生，
   * `ViewPrefs.sortBy` 字段仅为不动契约形状而保留。**不要据此新增排序 UI**。
   */
  setSortBy: (sortBy: SortBy) => Promise<void>;
  /**
   * ⚠️ 已无调用方（2026-09-15：痛感收敛为「只作默认排序键」，门槛判断已从
   * `domain/sort.isVisible` 移除）。与 `setSortBy` 同一处理方式：字段与 action 留在数据层，
   * **不要据此新增筛选 UI**。
   */
  setMinWeight: (minWeight: number) => Promise<void>;
  togglePin: (itemId: string) => Promise<void>;
  /**
   * 批量置顶 / 取消置顶（2026-09-28，聚合卡用）。
   *
   * 为什么不在组件里循环调 `togglePin`：那是**一次调用一次落盘**（`persist` 会写整个 view），
   * 三个成员就是三次写盘 —— 既慢，又让"哪一次失败才回滚"变得难判（`writeSeq` 只认最后一次）。
   * 这里把整组一次算完、一次写。
   *
   * `on = true` 时新 id 追加在既有置顶之后（`Set` 保序）；`on = false` 时只删给定的 id，
   * 不碰其它置顶项。
   */
  setPinned: (itemIds: string[], on: boolean) => Promise<void>;
  /** 被覆盖项的显示方式：dim 弱化 / hide 隐藏（只影响列表，不影响统计口径） */
  setCoverMode: (coverMode: CoverMode) => Promise<void>;
  /**
   * 卡片字段显示（2026-09-16；2026-09-30 起**按页面四套**）：`scope` 说改哪一页，
   * `patch` 说改哪几项（其余保持）。设置页的逐项开关与三档预设都走这一个 action
   * （预设 = 一次传六项），**只写这一页**，另外三页原样不动。
   */
  setCardDisplay: (scope: CardScope, patch: Partial<CardDisplay>) => Promise<void>;
  /** 覆盖集合显式快照（用户逐项配置后写全量数组） */
  setAutoSet: (autoSet: string[]) => Promise<void>;
  /** 恢复数据默认：把覆盖集合退回 `undefined`（跟随 `items.autoDaily`） */
  resetAutoSet: () => Promise<void>;
}

const FALLBACK: ViewPrefs = {
  profileId: '',
  /* 默认排序 = 条目库顺序（2026-09-30 起不再是痛感分） */
  sortBy: 'db',
  minWeight: 0,
  pinned: [],
  coverMode: 'dim',
  /* 四页各一份独立副本（`defaultCardByScope` 每次新建，避免把模块常量存进 state） */
  card: defaultCardByScope(),
  updatedAt: '',
};

/**
 * 写入序号：**只有最新一次写入的失败才允许回滚**。
 * 理由见 `stores/nurture` 里同名变量的注释 —— 连点两次筛选时，
 * 第一次的失败若赶在第二次之后返回，会把第二次的结果一起抹掉。
 */
let writeSeq = 0;

export const useViewStore = create<ViewState>((set, get) => {
  /** 乐观更新 + 落盘；失败回滚并提示 */
  const persist = async (next: ViewPrefs) => {
    const prev = get().view;
    const mine = ++writeSeq;
    set({ view: next, error: null });
    const { session } = useSessionStore.getState();
    if (!session) return;
    try {
      await api.saveView({ userId: session.userId, profileId: session.profileId }, next);
    } catch (e) {
      console.error('[view] 保存失败，回滚', e);
      if (mine !== writeSeq) return;
      set({ view: prev, error: e as Error });
    }
  };

  return {
    view: FALLBACK,
    defaults: null,
    error: null,

    applyView: (view, defaults) => set({ view, defaults, error: null }),

    setSortBy: (sortBy) => persist({ ...get().view, sortBy }),

    setMinWeight: (minWeight) => persist({ ...get().view, minWeight }),

    togglePin: (itemId) => {
      const { pinned } = get().view;
      const next = pinned.includes(itemId)
        ? pinned.filter((id) => id !== itemId)
        : [...pinned, itemId];
      return persist({ ...get().view, pinned: next });
    },

    setPinned: (itemIds, on) => {
      const set = new Set(get().view.pinned);
      for (const id of itemIds) {
        if (on) set.add(id);
        else set.delete(id);
      }
      return persist({ ...get().view, pinned: [...set] });
    },

    setCoverMode: (coverMode) => persist({ ...get().view, coverMode }),

    setCardDisplay: (scope, patch) =>
      persist({
        ...get().view,
        /* 只换这一页；另三页原样带过去 —— 每页在 `effectiveCardByScope` 里都是独立副本，
           所以改一页不会连坐另外三页（那是这个功能最容易出的静默 bug） */
        card: {
          ...get().view.card,
          [scope]: effectiveCardDisplay({ ...get().view.card?.[scope], ...patch }),
        },
      }),

    setAutoSet: (autoSet) => persist({ ...get().view, autoSet: [...new Set(autoSet)] }),

    resetAutoSet: () => persist({ ...get().view, autoSet: undefined }),
  };
});

/** 切号时清空内存态（由 `useBootstrap` 调用），避免旧账号的筛选/置顶闪现在新账号名下 */
export const resetViewMemory = (): void => {
  /* ++ 让在途写入的失败不再回滚到新账号上（见 `writeSeq` 的注释） */
  writeSeq += 1;
  useViewStore.setState({ view: FALLBACK, defaults: null, error: null });
};
