import { create } from 'zustand';

/**
 * 纯 UI 状态（导航 / 首屏加载态 / 二次确认）。
 * 不含业务数据 —— 业务数据一律走 api 契约（§2 分层铁律）。
 */
export type NavKey = 'today' | 'week' | 'limited' | 'stats' | 'tools' | 'me';

export const NAV_ITEMS: ReadonlyArray<{ key: NavKey; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
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

interface UiState {
  nav: NavKey;
  bootstrapLoading: boolean;
  bootstrapError: Error | null;
  confirmState: ConfirmOptions | null;
  /** 首屏重载计数：导入备份这类"整库变了"的场景 +1，让 `useBootstrap` 整体重跑 */
  bootstrapTick: number;
  setNav: (nav: NavKey) => void;
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
}

/** 当前待答的确认请求（只可能有一个：确认框是模态的） */
let resolveConfirm: ((ok: boolean) => void) | null = null;

export const useUiStore = create<UiState>((set) => ({
  nav: 'today',
  bootstrapLoading: true,
  bootstrapError: null,
  confirmState: null,
  bootstrapTick: 0,

  setNav: (nav) => set({ nav }),
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
}));
