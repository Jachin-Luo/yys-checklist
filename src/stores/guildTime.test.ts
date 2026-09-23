import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGuildTimeMemory, useGuildTimeStore } from './guildTime';
import { useSessionStore } from './session';

/**
 * 账号级寮时间 store。
 *
 * 2026-09-16 由设备级升格 —— 这里锁住的关键点是"**按当前账号的 scope 落盘**"，
 * 以及失败回滚（乐观更新必须能退回去，否则界面会显示一个并未保存的时间）。
 */
const { saveGuildTime } = vi.hoisted(() => ({ saveGuildTime: vi.fn(async () => undefined) }));
vi.mock('../api', () => ({ api: { saveGuildTime } }));

const SCOPE = { userId: 'u_local', profileId: 'p_main' };

beforeEach(() => {
  resetGuildTimeMemory();
  saveGuildTime.mockClear();
  saveGuildTime.mockImplementation(async () => undefined);
  useSessionStore.setState({ session: { ...SCOPE, authType: 'local' } });
});

afterEach(() => vi.restoreAllMocks());

describe('guildTime store（账号级）', () => {
  it('setGuildTime 改一条，并把整表落盘到当前账号的 scope', async () => {
    await useGuildTimeStore.getState().setGuildTime('daily_daoguan', '20:00');

    expect(useGuildTimeStore.getState().guildTime).toEqual({ daily_daoguan: '20:00' });
    expect(saveGuildTime).toHaveBeenCalledTimes(1);
    expect(saveGuildTime).toHaveBeenCalledWith(SCOPE, { daily_daoguan: '20:00' });
  });

  it('传空串 = 删除该条配置（与 domain/guildTime.withGuildTime 同一语义）', async () => {
    await useGuildTimeStore.getState().setGuildTime('daily_daoguan', '20:00');
    await useGuildTimeStore.getState().setGuildTime('daily_daoguan', '');
    expect(useGuildTimeStore.getState().guildTime).toEqual({});
  });

  it('clearGuildTime 清空并落盘空表', async () => {
    await useGuildTimeStore.getState().setGuildTime('daily_daoguan', '20:00');
    await useGuildTimeStore.getState().clearGuildTime();
    expect(useGuildTimeStore.getState().guildTime).toEqual({});
    expect(saveGuildTime).toHaveBeenLastCalledWith(SCOPE, {});
  });

  it('落盘失败 → 回滚到改之前的值并置 error', async () => {
    await useGuildTimeStore.getState().setGuildTime('daily_daoguan', '20:00');

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    saveGuildTime.mockRejectedValue(new Error('offline'));

    await useGuildTimeStore.getState().setGuildTime('daily_daoguan', '21:30');

    expect(useGuildTimeStore.getState().guildTime).toEqual({ daily_daoguan: '20:00' });
    expect(useGuildTimeStore.getState().error).toBeTruthy();
  });

  it('applyGuildTime 灌入首屏数据时不落盘（读路径不产生写）', () => {
    useGuildTimeStore.getState().applyGuildTime({ weekly_banquet: '20:30' });
    expect(useGuildTimeStore.getState().guildTime).toEqual({ weekly_banquet: '20:30' });
    expect(saveGuildTime).not.toHaveBeenCalled();
  });

  it('无会话时只改内存、不调用契约（首屏尚未就绪的降级路径）', async () => {
    useSessionStore.setState({ session: null });
    await useGuildTimeStore.getState().setGuildTime('daily_daoguan', '20:00');
    expect(useGuildTimeStore.getState().guildTime).toEqual({ daily_daoguan: '20:00' });
    expect(saveGuildTime).not.toHaveBeenCalled();
  });

  it('切号清空：resetGuildTimeMemory 不残留上一个号的时间', () => {
    useGuildTimeStore.setState({ guildTime: { daily_daoguan: '20:00' } });
    resetGuildTimeMemory();
    expect(useGuildTimeStore.getState().guildTime).toEqual({});
  });
});
