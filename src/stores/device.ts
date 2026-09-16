import { create } from 'zustand';
import { DEVICE_KEY, read, write } from '../services/localStore';

/**
 * 设备级状态（**不属于用户数据模型**：不随档案走、不上后端、mock 与 http 行为一致）。
 *
 * ## 2026-09-16 瘦身：只剩引导标记
 *
 * 寮时间与结界寄养任务**升为档案级**（见 `api/mock/persist.ts` 的分片表与
 * `UserDataBundle`）—— 它们都不是"这台手机的属性"，且用户要求"所有配置项均可备份"。
 * 相应入口迁到 `stores/guildTime`（新）与 `stores/nurture`（改为走契约）。
 *
 * 留下 `onboarded` 的理由：它**不是用户的配置项**，而是"这台设备看过引导没有"的状态。
 * 换设备后重看一次引导是正确的（引导里本来就有"配置寮时间"这一步），
 * 把它塞进备份反而会让新设备首次使用少了那一步。
 *
 * 保留 store（而不是组件内 `useState`）的理由没变：
 * 设置页点「重看引导」后要让引导层立即出现，而不是依赖页面重新挂载。
 */
interface DeviceState {
  /** 冷启动引导是否已完成（设备级一次性标记） */
  onboarded: boolean;
  hydrated: boolean;
  error: Error | null;
  /** 启动时从本机读一次 */
  hydrate: () => void;
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
    onboarded: false,
    hydrated: false,
    error: null,

    hydrate: () => {
      if (get().hydrated) return;
      set({
        onboarded: read<boolean>(DEVICE_KEY.onboarded) === true,
        hydrated: true,
      });
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
