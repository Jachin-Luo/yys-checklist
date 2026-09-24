import { create } from 'zustand';
import { api } from '../api';
import type { CardDisplay, ViewDefaults, ViewPrefs } from '../api/types';
import { DEFAULT_CARD_DISPLAY, effectiveCardDisplay } from '../domain/cardDisplay';
import type { GainKind, SortBy } from '../domain/enums';
import { effectiveView } from '../domain/merge';
import { useSessionStore } from './session';

/**
 * 视图偏好（设计文档 §7.3）。
 * 落盘键：`yys:view:{profileId}`；写入时机：改筛选 / 置顶 / 一键日常覆盖配置
 * （排序与痛感门槛已按产品决策取消写入，见下方 action 注释）。
 * 与勾选状态解耦：调视图不会丢勾选。
 */
export type CoverMode = 'dim' | 'hide';

/**
 * 「按奖励类型筛选」总开关 —— 2026-09-23 起为 `false`（筛选入口暂时下线，用户决策）。
 *
 * ⚠️ **关的不能只是控件**：如果只隐藏入口、却继续让存过的 `showKinds` 参与过滤，
 * 用户会看到"清单莫名少了几条"，而**既看不出原因、也没有任何地方能清掉它** ——
 * 那比没有这个功能更糟。所以消费侧（`hooks/useChecklist` 与 `pages/LimitedPage`）
 * 在这个开关为 false 时一律传空数组，等价于"该功能不存在"。
 *
 * 恢复方式：改回 `true` 即可。组件（`components/common/ViewBar`）会自己重新渲染，
 * `ViewPrefs.showKinds` 字段与 `domain/sort.isVisible` 的规则**一直原样保留**，
 * 不需要任何别的改动。
 */
/* 类型标注 `: boolean` 是**有意为之，别删**：不加的话 TS 会把常量收窄成字面量 `false`，
   于是 `ViewBar` 里那句 `if (!SHOW_KIND_FILTER) return null` 之后的代码被判定为不可达、
   `useChecklist` 里的三元被判定为恒取 `[]`。当前 tsconfig 未开 `allowUnreachableCode: false`
   所以不会报错，但这属于"靠编译器配置兜着"的脆弱状态，显式给个宽类型就没有了。 */
export const SHOW_KIND_FILTER: boolean = false;

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
   * ⚠️ 已无调用方（2026-09-23 筛选入口暂时下线）：字段与 action 留在数据层，
   * 生效与否统一由 `SHOW_KIND_FILTER` 决定 —— **要恢复筛选请改那个开关，不要另起控件**。
   */
  setShowKinds: (kinds: GainKind[]) => Promise<void>;
  /**
   * ⚠️ 已无调用方（2026-09-15：痛感收敛为「只作默认排序键」，门槛判断已从
   * `domain/sort.isVisible` 移除）。与 `setSortBy` 同一处理方式：字段与 action 留在数据层，
   * **不要据此新增筛选 UI**。
   */
  setMinWeight: (minWeight: number) => Promise<void>;
  togglePin: (itemId: string) => Promise<void>;
  /** 被覆盖项的显示方式：dim 弱化 / hide 隐藏（只影响列表，不影响统计口径） */
  setCoverMode: (coverMode: CoverMode) => Promise<void>;
  /**
   * 卡片字段显示（2026-09-16）：只传要改的项，其余保持 —— 设置页的逐项开关
   * 与三档预设都走这一个 action（预设 = 一次传六项）。
   */
  setCardDisplay: (patch: Partial<CardDisplay>) => Promise<void>;
  /** 覆盖集合显式快照（用户逐项配置后写全量数组） */
  setAutoSet: (autoSet: string[]) => Promise<void>;
  /** 恢复数据默认：把覆盖集合退回 `undefined`（跟随 `items.autoDaily`） */
  resetAutoSet: () => Promise<void>;
}

const FALLBACK: ViewPrefs = {
  profileId: '',
  sortBy: 'weight',
  showKinds: [],
  minWeight: 0,
  pinned: [],
  coverMode: 'dim',
  card: DEFAULT_CARD_DISPLAY,
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

    setShowKinds: (showKinds) => persist({ ...get().view, showKinds }),

    setMinWeight: (minWeight) => persist({ ...get().view, minWeight }),

    togglePin: (itemId) => {
      const { pinned } = get().view;
      const next = pinned.includes(itemId)
        ? pinned.filter((id) => id !== itemId)
        : [...pinned, itemId];
      return persist({ ...get().view, pinned: next });
    },

    setCoverMode: (coverMode) => persist({ ...get().view, coverMode }),

    setCardDisplay: (patch) =>
      persist({
        ...get().view,
        card: effectiveCardDisplay({ ...get().view.card, ...patch }),
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

/** 账号偏好缺失 / 非法字段回落默认（与 domain/merge.effectiveView 同一规则） */
export const normalizeView = (defaults: ViewDefaults, pref?: Partial<ViewPrefs> | null): ViewPrefs =>
  effectiveView(defaults, pref);
