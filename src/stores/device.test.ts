import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_KEY } from '../services/localStore';
import { installMemoryStorage } from '../test/memoryStorage';
import { useDeviceStore } from './device';

const storage = installMemoryStorage();

beforeEach(() => {
  storage.clear();
  storage.written.length = 0;
  useDeviceStore.setState({ onboarded: false, hydrated: false, error: null });
});

afterEach(() => vi.restoreAllMocks());

/**
 * 设备级状态。
 *
 * 2026-09-16：寮时间与结界寄养计划升为**档案级**（见 `stores/guildTime` /
 * `stores/nurture` 各自的测试），本文件只剩引导标记 —— 它的"设备级"身份没变，
 * 因为它不是配置，而是"这台设备看过引导没有"。
 */
describe('设备级状态（只剩引导标记）', () => {
  it('hydrate 从本机读引导标记，且幂等（已 hydrated 不再读）', () => {
    storage.setItem(DEVICE_KEY.onboarded, JSON.stringify(true));

    useDeviceStore.getState().hydrate();
    expect(useDeviceStore.getState().hydrated).toBe(true);
    expect(useDeviceStore.getState().onboarded).toBe(true);

    /* 内存态被人为改掉后再 hydrate：不该再读本机（幂等） */
    useDeviceStore.setState({ onboarded: false });
    useDeviceStore.getState().hydrate();
    expect(useDeviceStore.getState().onboarded).toBe(false);
  });

  it('本机无数据时给出安全默认值', () => {
    useDeviceStore.getState().hydrate();
    expect(useDeviceStore.getState().onboarded).toBe(false);
  });

  it('markOnboarded / resetOnboarding 落盘到设备级键', () => {
    useDeviceStore.getState().markOnboarded();
    expect(useDeviceStore.getState().onboarded).toBe(true);
    expect(storage.written).toContain(DEVICE_KEY.onboarded);

    useDeviceStore.getState().resetOnboarding();
    expect(useDeviceStore.getState().onboarded).toBe(false);
    expect(storage.written).toContain(DEVICE_KEY.onboarded);
  });

  it('写入失败时置 error，但内存态仍然生效（不挡住用户继续用）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });

    useDeviceStore.getState().markOnboarded();
    expect(useDeviceStore.getState().error).toBeTruthy();
    /* markOnboarded 里刻意在 persist 之后又 set 了一次：存储不可用时引导仍要能关掉，
       否则用户会被一个永远关不掉的弹层挡在外面 */
    expect(useDeviceStore.getState().onboarded).toBe(true);
  });
});
