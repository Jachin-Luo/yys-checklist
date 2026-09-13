import { useDeviceStore } from '../stores/device';

/**
 * 设备级偏好的统一入口（寮时间 / 引导标记）。
 *
 * 「设备级」的含义：**不随档案走、不上后端**。同一台手机切大号小号时，
 * 寮还是那个寮、引导也不该重看 —— 所以它们不放进用户数据分片。
 *
 * 2026-09-11：随 `S7 提醒能力` 下线，`notify`（通知开关）与 `reminded`（已提醒标记）
 * 已从这里与 `stores/device` 一并移除。
 */
export function useDevicePrefs() {
  const guildTime = useDeviceStore((s) => s.guildTime);
  const onboarded = useDeviceStore((s) => s.onboarded);
  const hydrated = useDeviceStore((s) => s.hydrated);
  const setGuildTime = useDeviceStore((s) => s.setGuildTime);
  const clearGuildTime = useDeviceStore((s) => s.clearGuildTime);
  const markOnboarded = useDeviceStore((s) => s.markOnboarded);
  const resetOnboarding = useDeviceStore((s) => s.resetOnboarding);

  return {
    guildTime,
    onboarded,
    hydrated,
    setGuildTime,
    clearGuildTime,
    markOnboarded,
    resetOnboarding,
  };
}
