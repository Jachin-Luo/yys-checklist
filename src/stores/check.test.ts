/**
 * 一键日常双向级联的状态层单测（用户报告的缺口，必须有回归保护）。
 *
 * 锁定四件事：
 *   ① 勾选入口 → 入口与全部被覆盖项一起勾上，且**时间戳一致**（周期重置边界一致）
 *   ② 再次点击 → 对称取消
 *   ③ 整批只写 `yys:state:{profileId}` 一个分片
 *   ④ 写入失败 → 只回滚未保存项，界面与实际落盘结果一致
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { resetStoreForTest } from '../api/mock/userStore';
import { cascadeBatch, effectiveAutoSet, hubItem } from '../domain/autoDaily';
import type { Item } from '../api/types';
import { installMemoryStorage } from '../test/memoryStorage';
import { resetCheckMemory, useCheckStore } from './check';
import { useItemStore } from './items';
import { useSessionStore } from './session';
import { useViewStore } from './view';

const storage = installMemoryStorage();

const mk = (over: Partial<Item>): Item => ({
  id: 'x', name: '条目', cycle: 'daily', origin: 'preset', ...over,
});

const ITEMS: Item[] = [
  mk({ id: 'daily_auto_daily', name: '庭院事务·一键日常', isAutoHub: true }),
  mk({ id: 'daily_sign', name: '每日签到', autoDaily: true }),
  mk({ id: 'daily_free_draw', name: '每日免费一抽', autoDaily: true }),
  mk({ id: 'daily_fengmo', name: '逢魔之时' }),
  mk({ id: 'daily_shiguang_sign', until: '2026-09-30' }),
  mk({ id: 'daily_shiguang_tower', deadline: '2026-09-29 23:59' }),
];

const HUB_ID = 'daily_auto_daily';

function bootstrap() {
  storage.clear();
  resetStoreForTest();
  useSessionStore.setState({
    session: { userId: 'u_local', profileId: 'p_main', authType: 'local' },
    profiles: [],
    error: null,
  });
  useItemStore.setState({ items: ITEMS, meta: null, overrides: null, error: null });
  useViewStore.setState({
    view: {
      profileId: 'p_main', sortBy: 'weight', showKinds: [], minWeight: 0,
      hideDone: false, pinned: [], coverMode: 'dim', updatedAt: '',
    },
    defaults: null,
    error: null,
  });
  resetCheckMemory();
}

const autoSetOf = () => effectiveAutoSet(ITEMS, useViewStore.getState().view);
const cascadeIds = () => cascadeBatch(ITEMS, HUB_ID, autoSetOf()).slice(1);

beforeEach(bootstrap);
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('一键日常：双向级联', () => {
  it('勾选入口 → 入口 + 全部被覆盖项一起勾上，时间戳一致', async () => {
    expect(autoSetOf()).toEqual(['daily_sign', 'daily_free_draw']);
    await useCheckStore.getState().toggleWithCascade(HUB_ID, cascadeIds());

    const { checked } = useCheckStore.getState();
    expect(checked[HUB_ID]).toBeTypeOf('number');
    expect(checked.daily_sign).toBe(checked[HUB_ID]);
    expect(checked.daily_free_draw).toBe(checked[HUB_ID]);
    /* 不在覆盖集合里的条目不受影响 */
    expect(checked.daily_fengmo).toBeUndefined();
  });

  it('再次点击入口 → 一并取消（对称）', async () => {
    await useCheckStore.getState().toggleWithCascade(HUB_ID, cascadeIds());
    await useCheckStore.getState().toggleWithCascade(HUB_ID, cascadeIds());
    expect(useCheckStore.getState().checked).toEqual({});
  });

  it('整批只写 yys:state:p_main 一个分片', async () => {
    storage.clear();
    await useCheckStore.getState().toggleWithCascade(HUB_ID, cascadeIds());
    expect(storage.written).toEqual(['yys:state:p_main', 'yys:state:p_main', 'yys:state:p_main']);
    expect(new Set(storage.written)).toEqual(new Set(['yys:state:p_main']));
  });

  it('用户把覆盖集合改成空 → 点入口只影响自己（不误伤其它条目）', async () => {
    useViewStore.setState((s) => ({ view: { ...s.view, autoSet: [] } }));
    expect(autoSetOf()).toEqual([]);
    await useCheckStore.getState().toggleWithCascade(HUB_ID, cascadeIds());
    expect(useCheckStore.getState().checked).toEqual({ [HUB_ID]: expect.any(Number) });
  });

  it('旧配置中的活动每日不被级联勾选或取消，已有手动完成记录保持不变', async () => {
    await useViewStore.getState().setAutoSet([
      'daily_sign', 'daily_shiguang_sign', 'daily_shiguang_tower',
    ]);
    await useCheckStore.getState().toggle('daily_shiguang_sign');
    const manualAt = useCheckStore.getState().checked.daily_shiguang_sign;
    expect(manualAt).toBeTypeOf('number');
    expect(autoSetOf()).toEqual(['daily_sign']);

    await useCheckStore.getState().toggleWithCascade(HUB_ID, cascadeIds());
    const checked = useCheckStore.getState().checked;
    expect(checked.daily_sign).toBe(checked[HUB_ID]);
    expect(checked.daily_shiguang_sign).toBe(manualAt);
    expect(checked.daily_shiguang_tower).toBeUndefined();

    await useCheckStore.getState().toggleWithCascade(HUB_ID, cascadeIds());
    expect(useCheckStore.getState().checked).toEqual({ daily_shiguang_sign: manualAt });
    const persisted = JSON.parse(storage.getItem('yys:state:p_main') ?? '{}');
    expect(persisted.checked).toEqual({ daily_shiguang_sign: manualAt });
  });

  it('全部写入失败 → 整批回滚', async () => {
    const env = import.meta.env as unknown as Record<string, string | undefined>;
    env.VITE_API_FAIL = '1';
    try {
      await useCheckStore.getState().toggleWithCascade(HUB_ID, cascadeIds());
      expect(useCheckStore.getState().checked).toEqual({});
      expect(useCheckStore.getState().error).toBeTruthy();
    } finally {
      delete env.VITE_API_FAIL;
    }
  });
});

describe('保存失败与连续操作', () => {
  it('存储配额不足：勾选回滚，API 缓存和磁盘都保持未完成', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });

    await useCheckStore.getState().toggle('daily_sign');

    expect(useCheckStore.getState().checked).toEqual({});
    expect(useCheckStore.getState().error?.message).toContain('空间不足');
    expect((await api.getState({ userId: 'u_local', profileId: 'p_main' })).checked).toEqual({});
    expect(storage.getItem('yys:state:p_main')).toBeNull();
  });

  it('取消保存失败时，恢复上一次已保存的勾选', async () => {
    await useCheckStore.getState().toggle('daily_sign');
    const checked = { ...useCheckStore.getState().checked };
    const persisted = storage.getItem('yys:state:p_main');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });

    await useCheckStore.getState().toggle('daily_sign');

    expect(useCheckStore.getState().checked).toEqual(checked);
    expect(storage.getItem('yys:state:p_main')).toBe(persisted);
    expect(useCheckStore.getState().error).toBeTruthy();
  });

  it('批量部分失败：保留成功项，只撤回失败项', async () => {
    const setItem = storage.setItem.bind(storage);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key === 'yys:state:p_main' && JSON.parse(value).checked.daily_free_draw !== undefined) {
        throw new DOMException('Full', 'QuotaExceededError');
      }
      setItem(key, value);
    });

    await useCheckStore.getState().toggleWithCascade(HUB_ID, cascadeIds());

    const { checked, error } = useCheckStore.getState();
    expect(checked).toEqual({ [HUB_ID]: expect.any(Number), daily_sign: checked[HUB_ID] });
    expect(JSON.parse(storage.getItem('yys:state:p_main')!).checked).toEqual(checked);
    expect(error).toBeTruthy();
  });

  it('连续勾选和取消都失败时，不恢复尚未保存的乐观状态', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(api, 'setChecked').mockRejectedValue(new Error('Save failed'));

    const check = useCheckStore.getState().toggle('daily_sign');
    const uncheck = useCheckStore.getState().toggle('daily_sign');
    await Promise.all([check, uncheck]);

    expect(useCheckStore.getState().checked).toEqual({});
    expect(useCheckStore.getState().error).toBeTruthy();
  });

  it('连续操作按发起顺序保存，不受各次请求延迟影响', async () => {
    let persisted: number | null = null;
    vi.spyOn(api, 'setChecked').mockImplementation(async (_scope, _id, at) => {
      await new Promise((resolve) => setTimeout(resolve, at === null ? 0 : 20));
      persisted = at;
    });

    const check = useCheckStore.getState().toggle('daily_sign');
    const uncheck = useCheckStore.getState().toggle('daily_sign');
    await Promise.all([check, uncheck]);

    expect(useCheckStore.getState().checked).toEqual({});
    expect(persisted).toBeNull();
  });

  it('前次失败不会撤回另一个条目的新勾选', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(api, 'setChecked').mockImplementation(async (_scope, id) => {
      if (id === 'daily_sign') throw new Error('Save failed');
    });

    await Promise.all([
      useCheckStore.getState().toggle('daily_sign'),
      useCheckStore.getState().toggle('daily_fengmo'),
    ]);

    expect(useCheckStore.getState().checked).toEqual({ daily_fengmo: expect.any(Number) });
  });

  it('清空失败不会覆盖随后成功的单项取消', async () => {
    await useCheckStore.getState().toggle('daily_sign');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(api, 'clearAllChecked').mockRejectedValue(new Error('Clear failed'));

    const clear = useCheckStore.getState().clearAll();
    const uncheck = useCheckStore.getState().setMany(['daily_sign'], null);
    await Promise.all([clear, uncheck]);

    expect(useCheckStore.getState().checked).toEqual({});
    expect(JSON.parse(storage.getItem('yys:state:p_main')!).checked).toEqual({});
  });

  it('旧档案写入失败不会覆盖新档案的内存', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(api, 'setChecked').mockRejectedValue(new Error('Save failed'));

    const pending = useCheckStore.getState().toggle('daily_sign');
    useSessionStore.setState({
      session: { userId: 'u_local', profileId: 'p_other', authType: 'local' },
    });
    resetCheckMemory();
    useCheckStore.getState().applyChecked({ daily_fengmo: 123 });
    await pending;

    expect(useCheckStore.getState().checked).toEqual({ daily_fengmo: 123 });
    expect(useCheckStore.getState().error).toBeNull();
  });

  it('同一档案重新加载后，旧清空失败不能恢复旧数据', async () => {
    await useCheckStore.getState().toggle('daily_sign');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(api, 'clearAllChecked').mockRejectedValue(new Error('Clear failed'));

    const pending = useCheckStore.getState().clearAll();
    resetCheckMemory();
    useCheckStore.getState().applyChecked({ daily_fengmo: 123 });
    await pending;

    expect(useCheckStore.getState().checked).toEqual({ daily_fengmo: 123 });
    expect(useCheckStore.getState().error).toBeNull();
  });

  it('跨过重置时刻后，取消失败也不能恢复上一日勾选', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 14, 4, 59));
    useItemStore.setState({ meta: await api.getMeta() });
    await useCheckStore.getState().toggle('daily_sign');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(api, 'setChecked').mockRejectedValue(new Error('Save failed'));

    const pending = useCheckStore.getState().toggle('daily_sign');
    vi.setSystemTime(new Date(2026, 8, 14, 5, 1));
    await pending;

    expect(useCheckStore.getState().checked).toEqual({});
    expect(useCheckStore.getState().error).toBeTruthy();
  });
});

describe('一键日常：覆盖集合可配置', () => {
  it('setAutoSet 写显式快照，resetAutoSet 退回跟随数据默认', async () => {
    await useViewStore.getState().setAutoSet(['daily_free_draw']);
    expect(autoSetOf()).toEqual(['daily_free_draw']);

    await useViewStore.getState().resetAutoSet();
    expect(useViewStore.getState().view.autoSet).toBeUndefined();
    expect(autoSetOf()).toEqual(['daily_sign', 'daily_free_draw']);
  });

  it('setCoverMode 只写视图偏好分片', async () => {
    storage.clear();
    await useViewStore.getState().setCoverMode('hide');
    expect(useViewStore.getState().view.coverMode).toBe('hide');
    expect(storage.written).toEqual(['yys:view:p_main']);
  });

  it('hubItem 与覆盖集合命中同一入口', () => {
    expect(hubItem(ITEMS)?.id).toBe(HUB_ID);
  });
});
