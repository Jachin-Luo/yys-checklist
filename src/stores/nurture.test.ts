import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from './session';
import { resetNurtureMemory, useNurtureStore } from './nurture';

/**
 * 结界寄养 store。
 *
 * 2026-09-16：由设备级升为**档案级**，落盘从"直写 localStorage"改为走契约
 * `api.savePlans(scope, plans)`。因此这里的断言对象也随之变化：
 * 不再检查 `storage.written`，而是检查**契约调用**（这是新架构下的正确边界 ——
 * 分片键是 Mock 的实现细节，store 根本不知道它叫什么）。
 */
const { savePlans } = vi.hoisted(() => ({ savePlans: vi.fn(async () => undefined) }));
vi.mock('../api', () => ({ api: { savePlans } }));

const SCOPE = { userId: 'u_local', profileId: 'p_main' };

beforeEach(() => {
  resetNurtureMemory();
  savePlans.mockClear();
  savePlans.mockImplementation(async () => undefined);
  useSessionStore.setState({
    session: { userId: SCOPE.userId, profileId: SCOPE.profileId, authType: 'local' },
  });
});

afterEach(() => vi.restoreAllMocks());

describe('nurture store（档案级）', () => {
  it('add 后进入内存态，并按当前档案的 scope 落盘', async () => {
    await useNurtureStore.getState().add('20:00', 3, false);

    const records = useNurtureStore.getState().records;
    expect(records).toHaveLength(1);
    expect(records[0].base).toBe('20:00');
    expect(records[0].started).toBe(false);

    expect(savePlans).toHaveBeenCalledTimes(1);
    /* 断言"按当前档案的 scope 落盘"——这是升为档案级后最关键的一条契约 */
    expect(savePlans).toHaveBeenCalledWith(SCOPE, records);
  });

  it('applyPlans 直接灌入首屏数据（不触发落盘）', () => {
    useNurtureStore.getState().applyPlans([
      { id: 'n_1', base: '08:00', n: 2, started: true, createdAt: 1 },
    ]);
    expect(useNurtureStore.getState().records).toHaveLength(1);
    expect(savePlans).not.toHaveBeenCalled();
  });

  it.each(['add', 'promote', 'remove', 'clearAll'] as const)(
    '%s 落盘失败时回滚内存态并置 error',
    async (operation) => {
      await useNurtureStore.getState().add('20:00', 3, false);
      const records = useNurtureStore.getState().records;

      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      savePlans.mockRejectedValue(new Error('offline'));

      const actions = {
        add: () => useNurtureStore.getState().add('21:00', 2, true),
        promote: () => useNurtureStore.getState().promote(records[0].id),
        remove: () => useNurtureStore.getState().remove(records[0].id),
        clearAll: () => useNurtureStore.getState().clearAll(),
      };

      await actions[operation]();

      /* 回滚到刚才那份 —— 失败时界面必须与已落盘的内容一致 */
      expect(useNurtureStore.getState().records).toEqual(records);
      expect(useNurtureStore.getState().error).toBeTruthy();
    },
  );

  it('旧写的失败回滚不会抹掉新写的状态（writeSeq 守卫）', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    /* 第一次落盘挂起（稍后才失败），第二次立刻成功 —— 模拟"连点两下、先失败的后返回"。
       没有守卫时，第一次的 catch 会把内存回滚成 [A]，而磁盘已经是 [C,B,A]：
       内存与磁盘不一致，且用户看到刚加的那条凭空消失。 */
    let failFirst: (e: Error) => void = () => undefined;
    savePlans.mockImplementationOnce(
      () => new Promise<undefined>((_, reject) => {
        failFirst = reject;
      }),
    );

    const first = useNurtureStore.getState().add('20:00', 2, true);
    const second = useNurtureStore.getState().add('21:00', 3, true);
    await second;
    expect(useNurtureStore.getState().records).toHaveLength(2);

    failFirst(new Error('offline'));
    await first;
    await Promise.resolve();

    expect(useNurtureStore.getState().records).toHaveLength(2);
  });

  it('无会话时只改内存、不调用契约（首屏尚未就绪的降级路径）', async () => {
    useSessionStore.setState({ session: null });
    await useNurtureStore.getState().add('20:00', 3, false);
    expect(useNurtureStore.getState().records).toHaveLength(1);
    expect(savePlans).not.toHaveBeenCalled();
  });
});
