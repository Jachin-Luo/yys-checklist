import { create } from 'zustand';

/**
 * 纯 UI 状态（导航 / 首屏加载态 / 二次确认）。
 * 不含业务数据 —— 业务数据一律走 api 契约（§2 分层铁律）。
 */
export type NavKey = 'today' | 'week' | 'month' | 'limited' | 'stats' | 'tools' | 'me';

export const NAV_ITEMS: ReadonlyArray<{ key: NavKey; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'limited', label: '限时' },
  { key: 'stats', label: '统计' },
  { key: 'tools', label: '工具' },
  { key: 'me', label: '我的' },
];

/** 二次确认的入参（删档 / 归档 / 恢复默认条目库 / 清空勾选…） */
export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'normal';
}

/** 跨档案勾选选择器的入参（清单长按） */
export interface PickOptions {
  itemId: string;
  /** 条目名，弹层标题里要显示（"「每日签到」同时勾选到…"） */
  itemName: string;
  /** 当前档案这一条是否已完成：决定文案是"一起勾选"还是"一起取消" */
  checked: boolean;
}

interface UiState {
  nav: NavKey;
  bootstrapLoading: boolean;
  bootstrapError: Error | null;
  confirmState: ConfirmOptions | null;
  /** 首屏重载计数：导入备份这类"整库变了"的场景 +1，让 `useBootstrap` 整体重跑 */
  bootstrapTick: number;
  /**
   * 一次性「跳转请求」：目标页面 + 目标分区 / 分段。两个调用点：
   *   - 今日页一键日常入口卡的「去设置」→ `{ nav: 'me', section: 'autoDaily' }`
   *   - 壳层的结界卡徽章 → `{ nav: 'tools', section: 'nurture' }`
   * 目标页面在挂载时消费它（展开 / 选中对应分区、必要时滚动）后立即清空。
   * 用一次性标记而不是常驻开关：跳过来时生效一次，之后用户自己切来切去不受影响。
   */
  navRequest: { nav: NavKey; section?: string } | null;
  setNav: (nav: NavKey) => void;
  requestNav: (req: { nav: NavKey; section?: string }) => void;
  clearNavRequest: () => void;
  setBootstrapLoading: (loading: boolean) => void;
  setBootstrapError: (error: Error | null) => void;
  /**
   * 请求整库重载（导入备份后调用）。
   * 为什么复用 `useBootstrap` 而不是另写一份"局部刷新"：那份逻辑已经处理了
   * 内存态清空顺序、取消守卫与错误呈现，重写一遍只会多一处会漂移的实现。
   */
  refreshBootstrap: () => void;
  /**
   * 弹二次确认并等待用户作答 —— `await askConfirm({...})` 直接拿到 boolean。
   * 用 Promise 而不是让每个组件各自维护弹窗状态：调用点从「三行状态 + 一段 JSX」
   * 收成一行判断，且不会再出现漏接 `onCancel` 的情况。
   */
  askConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  answerConfirm: (ok: boolean) => void;
  /**
   * 跨档案勾选的选择器（清单长按触发）。
   * 与 `askConfirm` 同一模式但带返回值 —— 用户要选的是**若干个档案 id**，
   * 不是"是 / 否"，所以不能复用确认弹窗。`null` = 用户取消。
   * 弹窗本体挂在 `App` 顶层（`ProfilePickDialog`），调用点不持有弹窗状态。
   */
  pickState: PickOptions | null;
  askPick: (opts: PickOptions) => Promise<string[] | null>;
  answerPick: (profileIds: string[] | null) => void;
}

/** 当前待答的确认请求（只可能有一个：确认框是模态的） */
let resolveConfirm: ((ok: boolean) => void) | null = null;

/** 当前待答的跨档案勾选请求（同样只可能有一个） */
let resolvePick: ((profileIds: string[] | null) => void) | null = null;

export const useUiStore = create<UiState>((set) => ({
  nav: 'today',
  bootstrapLoading: true,
  bootstrapError: null,
  confirmState: null,
  bootstrapTick: 0,
  navRequest: null,
  pickState: null,

  setNav: (nav) => set({ nav }),

  requestNav: (req) => set({ nav: req.nav, navRequest: req }),
  clearNavRequest: () => set({ navRequest: null }),
  setBootstrapLoading: (bootstrapLoading) => set({ bootstrapLoading }),
  setBootstrapError: (bootstrapError) => set({ bootstrapError }),

  refreshBootstrap: () =>
    set((s) => ({ bootstrapTick: s.bootstrapTick + 1, bootstrapLoading: true, bootstrapError: null })),

  askConfirm: (opts) =>
    new Promise<boolean>((resolve) => {
      /* 上一次未作答就被替换：按"取消"处理，避免 Promise 永久挂起 */
      resolveConfirm?.(false);
      resolveConfirm = resolve;
      set({ confirmState: opts });
    }),

  answerConfirm: (ok) => {
    const resolve = resolveConfirm;
    resolveConfirm = null;
    set({ confirmState: null });
    resolve?.(ok);
  },

  askPick: (opts) =>
    new Promise<string[] | null>((resolve) => {
      /* 同上：被后来的请求顶掉时按"取消"处理，避免 Promise 永久挂起 */
      resolvePick?.(null);
      resolvePick = resolve;
      set({ pickState: opts });
    }),

  answerPick: (profileIds) => {
    const resolve = resolvePick;
    resolvePick = null;
    set({ pickState: null });
    resolve?.(profileIds);
  },
}));
