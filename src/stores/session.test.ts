/**
 * 账号 store 单测（§6.4 四条边界）。
 *   ① 禁删 / 禁归档最后一个存活账号
 *   ② 归档当前账号 → 自动切到 sort 最小的存活账号
 *   ③ 归档账号可恢复、不出现在切换器用的 `aliveProfiles`
 *   ④ 切号会亮骨架屏（清空内存态由 `useBootstrap` 完成，避免旧数据错位帧）
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../api';
import { resetStoreForTest } from '../api/mock/userStore';
import { installMemoryStorage } from '../test/memoryStorage';
import { aliveProfiles, useSessionStore } from './session';
import { useUiStore } from './ui';

const storage = installMemoryStorage();

async function bootstrap() {
  storage.clear();
  resetStoreForTest();
  useSessionStore.setState({ session: null, profiles: [], error: null, saving: false });
  useUiStore.setState({ bootstrapLoading: false });
  const session = await api.getSession();
  useSessionStore.getState().applySession(session);
  await useSessionStore.getState().loadProfiles(session.userId);
}

beforeEach(bootstrap);

describe('loadProfiles：含已归档，切换器自行过滤', () => {
  it('初始只有一个存活账号，且是默认账号', () => {
    const { profiles } = useSessionStore.getState();
    expect(profiles).toHaveLength(1);
    expect(aliveProfiles(profiles).map((p) => p.id)).toEqual(['p_main']);
    expect(profiles[0].isDefault).toBe(true);
  });

  it('新建账号后按 sort 升序排列，且不抢默认标记', async () => {
    await useSessionStore.getState().createProfile({ name: '小号', server: '网易官服' });
    const { profiles } = useSessionStore.getState();
    expect(aliveProfiles(profiles).map((p) => p.name)).toEqual(['大号', '小号']);
    expect(aliveProfiles(profiles).find((p) => p.name === '小号')?.isDefault).toBe(false);
  });
});

describe('切换账号', () => {
  it('切号写入会话指针并亮起骨架屏', async () => {
    const p = await useSessionStore.getState().createProfile({ name: '小号' });
    await useSessionStore.getState().switchProfile(p!.id);

    expect(useSessionStore.getState().session?.profileId).toBe(p!.id);
    expect(useUiStore.getState().bootstrapLoading).toBe(true);
  });

  it('切换到当前账号是空操作', async () => {
    await useSessionStore.getState().switchProfile('p_main');
    expect(useSessionStore.getState().session?.profileId).toBe('p_main');
    expect(useSessionStore.getState().error).toBeNull();
  });
});

describe('归档：§6.4 边界', () => {
  it('禁归档最后一个存活账号', async () => {
    await useSessionStore.getState().archiveProfile('p_main');
    expect(useSessionStore.getState().error?.message).toContain('至少要保留一个账号');
    expect(aliveProfiles(useSessionStore.getState().profiles)).toHaveLength(1);
  });

  it('归档当前账号 → 自动切到另一个存活账号，切换器里也看不到它', async () => {
    const p = await useSessionStore.getState().createProfile({ name: '小号' });
    await useSessionStore.getState().switchProfile(p!.id);
    await useSessionStore.getState().archiveProfile(p!.id);

    const { profiles, session } = useSessionStore.getState();
    expect(session?.profileId).toBe('p_main');
    expect(aliveProfiles(profiles).map((x) => x.id)).toEqual(['p_main']);
    /* 归档账号仍在列表里（设置页要能恢复） */
    expect(profiles.find((x) => x.id === p!.id)?.archived).toBe(true);
  });

  it('恢复归档账号后重新出现在存活列表', async () => {
    const p = await useSessionStore.getState().createProfile({ name: '小号' });
    await useSessionStore.getState().archiveProfile(p!.id);
    await useSessionStore.getState().restoreProfile(p!.id);
    expect(aliveProfiles(useSessionStore.getState().profiles).map((x) => x.id)).toContain(p!.id);
  });
});

describe('删除：§6.4 边界', () => {
  it('禁删最后一个存活账号', async () => {
    await useSessionStore.getState().deleteProfile('p_main');
    expect(useSessionStore.getState().error?.message).toContain('至少要保留一个账号');
    expect(useSessionStore.getState().profiles).toHaveLength(1);
  });

  it('删除非当前账号 → 当前账号不变、数据分片被清理', async () => {
    const p = await useSessionStore.getState().createProfile({ name: '小号' });
    await useSessionStore.getState().deleteProfile(p!.id);

    const { profiles, session } = useSessionStore.getState();
    expect(session?.profileId).toBe('p_main');
    expect(profiles.some((x) => x.id === p!.id)).toBe(false);
    expect(storage.getItem(`yys:state:${p!.id}`)).toBeNull();
  });

  it('删除当前账号 → 自动切到存活账号', async () => {
    const p = await useSessionStore.getState().createProfile({ name: '小号' });
    await useSessionStore.getState().switchProfile(p!.id);
    await useSessionStore.getState().deleteProfile(p!.id);

    const { profiles, session } = useSessionStore.getState();
    expect(profiles.map((x) => x.id)).toEqual(['p_main']);
    expect(session?.profileId).toBe('p_main');
  });

  it('可以删掉已归档账号（它不在存活集合里，不受"禁删最后一个"限制）', async () => {
    const p = await useSessionStore.getState().createProfile({ name: '小号' });
    await useSessionStore.getState().archiveProfile(p!.id);
    await useSessionStore.getState().deleteProfile(p!.id);

    expect(useSessionStore.getState().error).toBeNull();
    expect(useSessionStore.getState().profiles.some((x) => x.id === p!.id)).toBe(false);
  });
});
