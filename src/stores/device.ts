import { create } from 'zustand';
import type { GuildTimePrefs } from '../domain/guildTime';
import { withGuildTime } from '../domain/guildTime';
import { DEVICE_KEY, read, write } from '../services/localStore';

/**
 * 设备级偏好（**不属于用户数据模型**：不随档案走、不上后端、mock 与 http 行为一致）。
 *
 * 做成 store 而不是各组件各自的 `useState`，是为了让「设置页改完 → 清单页立即生效」，
 * 而不是依赖页面重新挂载。
 *
 * 三项都属于"这台手机"而不是"这个游戏号"：
 *   寮时间（同一个寮）· 引导标记（看过一次就够）· 寄养计划（与玩哪个号无关）。
 *
 * 2026-09-11：随 `S7 提醒能力` 整体下线，原来的 `notify`（通知总开关）与
 * `reminded`（已提醒事件标记）两个字段一并删除 —— 它们只服务于通知与 `.ics` 导出。
 */
interface DeviceState {
  /** 寮时间：itemId -> 'HH:mm' */
  guildTime: GuildTimePrefs;
  /** 冷启动引导是否已完成（设备级一次性标记） */
  onboarded: boolean;
  hydrated: boolean;
  error: Error | null;
  /** 启动时从本机读一次 */
  hydrate: () => void;
  setGuildTime: (itemId: string, value: string) => void;
  clearGuildTime: () => void;
  markOnboarded: () => void;
  /** 设置页「重看引导」用 */
  resetOnboarding: () => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => {
  const persist = (key: string, value: unknown, patch: Partial<DeviceState>) => {
    try {
      write(key, value);
      set({ ...patch, error: null });
    } catch (e) {
      set({ error: e as Error });
    }
  };

  return {
  guildTime: {},
  onboarded: false,
  hydrated: false,
  error: null,

  hydrate: () => {
    if (get().hydrated) return;
    set({
      guildTime: read<GuildTimePrefs>(DEVICE_KEY.guildTime) ?? {},
      onboarded: read<boolean>(DEVICE_KEY.onboarded) === true,
      hydrated: true,
    });
  },

  setGuildTime: (itemId, value) => {
    const next = withGuildTime(get().guildTime, itemId, value);
    persist(DEVICE_KEY.guildTime, next, { guildTime: next });
  },

  clearGuildTime: () => {
    persist(DEVICE_KEY.guildTime, {}, { guildTime: {} });
  },

  markOnboarded: () => {
    persist(DEVICE_KEY.onboarded, true, { onboarded: true });
    // Dismiss onboarding even when storage is unavailable; the unsaved notice remains visible.
    set({ onboarded: true });
  },

  resetOnboarding: () => {
    persist(DEVICE_KEY.onboarded, false, { onboarded: false });
    set({ onboarded: false });
  },
  };
});
