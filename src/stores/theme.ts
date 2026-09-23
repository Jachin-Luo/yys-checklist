import { create } from 'zustand';
import { DEVICE_KEY, read, write } from '../services/localStore';

/**
 * 明暗主题（**设备级**，用户决策 2026-09-23）。
 *
 * ## 为什么是设备级而不是账号级
 *
 * 明暗是**屏幕与环境的属性**（白天 / 夜里、大屏 / 手机），不是"玩哪个号"的属性 ——
 * 切账号时主题跟着变会很怪。因此它和 `onboarded` 一样走 `DEVICE_KEY`：
 * 不随账号、不进备份、mock 与 http 两种模式行为一致。
 *
 * ## 初始值的优先级
 *
 *   1. 本机存过 → 用存过的（用户显式选过，不再跟随系统）；
 *   2. 没存过 → **跟随设备的 `prefers-color-scheme`**；
 *   3. 系统偏好也读不到（SSR / 老浏览器）→ 默认**明版**（和纸手札）。
 *
 * `explicit` 记住"用户选过没有"：没选过时系统切暗色，应用跟着切；
 * 一旦用户点过切换，就固定他自己的选择。
 */

export type Theme = 'light' | 'dark';

const SYSTEM_QUERY = '(prefers-color-scheme: dark)';

/** 读设备明暗；不可用时返回 null（交给调用方落回明版） */
function systemTheme(): Theme | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(SYSTEM_QUERY).matches ? 'dark' : 'light';
  } catch {
    return null;
  }
}

/** 把主题写到 `<html data-theme>` —— 全站换肤的唯一触发点 */
function apply(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

interface ThemeState {
  theme: Theme;
  /** 用户是否显式选择过（显式之后不再跟随系统） */
  explicit: boolean;
  hydrated: boolean;
  /** 首屏渲染**之前**调用（见 `main.tsx`），避免暗版用户闪一帧明版 */
  hydrate: () => void;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  /** 系统明暗变化时调用；仅在用户未显式选择时生效 */
  followSystem: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  explicit: false,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const stored = read<Theme>(DEVICE_KEY.theme);
    const explicit = stored === 'light' || stored === 'dark';
    const theme: Theme = explicit ? (stored as Theme) : (systemTheme() ?? 'light');
    apply(theme);
    set({ theme, explicit, hydrated: true });
  },

  setTheme: (theme) => {
    apply(theme);
    try {
      write(DEVICE_KEY.theme, theme);
    } catch {
      /* 主题是纯观感项：落盘失败（隐私模式 / 配额）不阻塞换肤，本次会话内仍生效 */
    }
    set({ theme, explicit: true });
  },

  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  followSystem: () => {
    if (get().explicit) return;
    const next = systemTheme();
    if (!next || next === get().theme) return;
    apply(next);
    set({ theme: next });
  },
}));
