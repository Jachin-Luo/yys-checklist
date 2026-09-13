/**
 * 设备级偏好 store 单测。
 * 重点：**只写设备级键**，绝不碰用户数据分片（`yys:state|view|ovr:*` / `yys:profiles` / `yys:meta:session`）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_KEY } from '../services/localStore';
import { installMemoryStorage } from '../test/memoryStorage';
import { useDeviceStore } from './device';

const storage = installMemoryStorage();

const USER_SHARD_PREFIXES = ['yys:state:', 'yys:view:', 'yys:ovr:'];

beforeEach(() => {
  storage.clear();
  useDeviceStore.setState({ guildTime: {}, onboarded: false, hydrated: false, error: null });
});

afterEach(() => vi.restoreAllMocks());

describe('hydrate：从本机读一次', () => {
  it('首次读取后 hydrated=true；重复调用不覆盖内存态', () => {
    storage.setItem(DEVICE_KEY.guildTime, JSON.stringify({ daily_daoguan: '20:00' }));
    storage.setItem(DEVICE_KEY.onboarded, JSON.stringify(true));

    useDeviceStore.getState().hydrate();
    expect(useDeviceStore.getState().hydrated).toBe(true);
    expect(useDeviceStore.getState().guildTime).toEqual({ daily_daoguan: '20:00' });
    expect(useDeviceStore.getState().onboarded).toBe(true);

    useDeviceStore.setState({ guildTime: { weekly_banquet: '20:30' } });
    useDeviceStore.getState().hydrate();
    expect(useDeviceStore.getState().guildTime).toEqual({ weekly_banquet: '20:30' });
  });

  it('本机无数据时给出安全默认值', () => {
    useDeviceStore.getState().hydrate();
    expect(useDeviceStore.getState().guildTime).toEqual({});
    expect(useDeviceStore.getState().onboarded).toBe(false);
  });
});

describe('写入：只动设备级键', () => {
  it('setGuildTime / clearGuildTime 只写 yys:guildTime', () => {
    useDeviceStore.getState().setGuildTime('daily_daoguan', '20:00');
    expect(storage.written).toEqual([DEVICE_KEY.guildTime]);
    expect(useDeviceStore.getState().guildTime).toEqual({ daily_daoguan: '20:00' });

    storage.clear();
    useDeviceStore.getState().clearGuildTime();
    expect(storage.written).toEqual([DEVICE_KEY.guildTime]);
    expect(useDeviceStore.getState().guildTime).toEqual({});
  });

  it('引导标记写入 yys:onboarded，可重置以重看', () => {
    useDeviceStore.getState().markOnboarded();
    expect(storage.written).toEqual([DEVICE_KEY.onboarded]);
    expect(useDeviceStore.getState().onboarded).toBe(true);

    storage.clear();
    useDeviceStore.getState().resetOnboarding();
    expect(storage.written).toEqual([DEVICE_KEY.onboarded]);
    expect(useDeviceStore.getState().onboarded).toBe(false);
  });

  it('任何设备级写入都不会碰用户数据分片', () => {
    useDeviceStore.getState().setGuildTime('daily_daoguan', '20:00');
    useDeviceStore.getState().markOnboarded();
    const touchedUserShard = storage.written.some((k) => USER_SHARD_PREFIXES.some((p) => k.startsWith(p)));
    expect(touchedUserShard).toBe(false);
    expect(storage.written).not.toContain('yys:profiles');
    expect(storage.written).not.toContain('yys:meta:session');
  });
});

describe('设备偏好保存失败', () => {
  it('寮时间修改或清空失败时保留原值，重试成功后清除错误', () => {
    useDeviceStore.getState().setGuildTime('daily_daoguan', '20:00');
    const before = storage.getItem(DEVICE_KEY.guildTime);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const write = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });

    useDeviceStore.getState().setGuildTime('daily_daoguan', '21:00');
    expect(useDeviceStore.getState().guildTime).toEqual({ daily_daoguan: '20:00' });
    useDeviceStore.getState().clearGuildTime();
    expect(useDeviceStore.getState().guildTime).toEqual({ daily_daoguan: '20:00' });
    expect(storage.getItem(DEVICE_KEY.guildTime)).toBe(before);
    expect(useDeviceStore.getState().error).toBeTruthy();

    write.mockRestore();
    useDeviceStore.getState().setGuildTime('daily_daoguan', '21:00');
    expect(useDeviceStore.getState().guildTime).toEqual({ daily_daoguan: '21:00' });
    expect(useDeviceStore.getState().error).toBeNull();
  });

  it('无法保存引导标记时仍可关闭引导，但保留未保存提示', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });

    expect(() => useDeviceStore.getState().markOnboarded()).not.toThrow();
    expect(useDeviceStore.getState().onboarded).toBe(true);
    expect(useDeviceStore.getState().error).toBeTruthy();
    expect(storage.getItem(DEVICE_KEY.onboarded)).toBeNull();
  });
});
