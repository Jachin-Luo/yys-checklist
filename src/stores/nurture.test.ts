import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from './session';
import { resetNurtureMemory, useNurtureStore } from './nurture';

/**
 * 结界寄养 store。
 *
 * 2026-09-16：由设备级升为**账号级**，落盘从"直写 localStorage"改为走契约
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

describe('nurture store（账号级）', () => {
  it('add 后进入内存态，并按当前账号的 scope 落盘', async () => {
    await useNurtureStore.getState().add('20:00', 24, 0, false);

    const records = useNurtureStore.getState().records;
    expect(records).toHaveLength(1);
    expect(records[0].base).toBe('20:00');
    expect(records[0].started).toBe(false);

    expect(savePlans).toHaveBeenCalledTimes(1);
    /* 断言"按当前账号的 scope 落盘"——这是升为账号级后最关键的一条契约 */
    expect(savePlans).toHaveBeenCalledWith(SCOPE, records);
  });

  it('applyPlans 直接灌入首屏数据（不触发落盘）', () => {
    useNurtureStore.getState().applyPlans([
      { id: 'n_1', base: '08:00', hours: 12, delay: 0, started: true, createdAt: 1 },
    ]);
    expect(useNurtureStore.getState().records).toHaveLength(1);
    expect(savePlans).not.toHaveBeenCalled();
  });

  it.each(['add', 'promote', 'remove', 'clearAll'] as const)(
    '%s 落盘失败时回滚内存态并置 error',
    async (operation) => {
      await useNurtureStore.getState().add('20:00', 24, 0, false);
      const records = useNurtureStore.getState().records;

      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      savePlans.mockRejectedValue(new Error('offline'));

      const actions = {
        add: () => useNurtureStore.getState().add('21:00', 12, 0, true),
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

    const first = useNurtureStore.getState().add('20:00', 12, 0, true);
    const second = useNurtureStore.getState().add('21:00', 24, 5, true);
    await second;
    expect(useNurtureStore.getState().records).toHaveLength(2);

    failFirst(new Error('offline'));
    await first;
    await Promise.resolve();

    expect(useNurtureStore.getState().records).toHaveLength(2);
  });

  it('无会话时只改内存、不调用契约（首屏尚未就绪的降级路径）', async () => {
    useSessionStore.setState({ session: null });
    await useNurtureStore.getState().add('20:00', 24, 0, false);
    expect(useNurtureStore.getState().records).toHaveLength(1);
    expect(savePlans).not.toHaveBeenCalled();
  });
});

/**
 * 「同时只允许一条进行中的任务」（2026-09-28 用户要求）。
 * 两条纪律：① 开始新任务 = 结束旧任务（**不删**，点列表要能回看）；
 *           ② 「仅存计划」不碰任何既有记录（计划不等于开始）。
 */
describe('进行中的任务只能有一条', () => {
  it('开始新任务时给上一条盖 `endedAt`，记录本身保留', async () => {
    await useNurtureStore.getState().add('10:00', 24, 0, true);
    const first = useNurtureStore.getState().records[0];

    await useNurtureStore.getState().add('20:00', 24, 0, true);
    const [second, closed] = useNurtureStore.getState().records;

    expect(second.id).not.toBe(first.id);
    expect(second.endedAt).toBeUndefined();
    expect(closed.id).toBe(first.id);
    expect(typeof closed.endedAt).toBe('number');
    expect(closed.base).toBe('10:00');
  });

  it('「仅存计划」不碰既有任务', async () => {
    await useNurtureStore.getState().add('10:00', 24, 0, true);
    await useNurtureStore.getState().add('20:00', 24, 0, false);
    expect(useNurtureStore.getState().records.every((r) => r.endedAt === undefined)).toBe(true);
  });

  it('promote 补记起始日期，并结束其它进行中的任务', async () => {
    await useNurtureStore.getState().add('10:00', 24, 0, true);
    await useNurtureStore.getState().add('21:00', 12, 0, false);
    const plan = useNurtureStore.getState().records.find((r) => !r.started);
    expect(plan).toBeTruthy();

    await useNurtureStore.getState().promote(plan!.id);

    const list = useNurtureStore.getState().records;
    const promoted = list.find((r) => r.id === plan!.id)!;
    expect(promoted.started).toBe(true);
    expect(promoted.baseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof list.find((r) => r.id !== plan!.id)!.endedAt).toBe('number');
  });
});
