/**
 * 条目 store 单测（F20 条目自定义的写路径）。
 *
 * 重点锁定一件事：`reloadItems()` 必须**重新合并覆盖层**——
 * 只拿 `listItems()`（完整种子）会把已隐藏的条目又放回来、把自建条目丢掉。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../api';
import { resetStoreForTest } from '../api/mock/userStore';
import { activeItems } from '../domain/reset';
import { installMemoryStorage } from '../test/memoryStorage';
import { useItemStore } from './items';
import { useSessionStore } from './session';

const storage = installMemoryStorage();

beforeEach(() => {
  storage.clear();
  resetStoreForTest();
  useSessionStore.setState({
    session: { userId: 'u_local', profileId: 'p_main', authType: 'local' },
    profiles: [],
    error: null,
  });
  useItemStore.setState({ meta: null, items: [], presetItems: [], overrides: null, error: null });
});

describe('reloadItems：种子 − 已隐藏 + 自建', () => {
  it('拉取后得到完整种子（含已隐藏项）与有效条目两种视图', async () => {
    const seed = await api.listItems();
    await useItemStore.getState().reloadItems();
    const { presetItems, items } = useItemStore.getState();
    expect(seed.length).toBeGreaterThan(0);
    expect(presetItems).toEqual(seed);
    expect(items).toEqual(activeItems(seed, new Date()));
    expect(presetItems.every((it) => it.origin === 'preset')).toBe(true);
  });

  it('隐藏预设 → 有效条目少一条，但预设池里仍然查得到（可恢复）', async () => {
    await useItemStore.getState().hideItem('daily_sign');
    const { items, presetItems, overrides } = useItemStore.getState();
    expect(items.some((it) => it.id === 'daily_sign')).toBe(false);
    expect(presetItems.some((it) => it.id === 'daily_sign')).toBe(true);
    expect(overrides?.hidden).toContain('daily_sign');

    await useItemStore.getState().restoreItem('daily_sign');
    expect(useItemStore.getState().items.some((it) => it.id === 'daily_sign')).toBe(true);
  });

  it('新增自建条目 → 进入有效条目且 origin 为 custom', async () => {
    const created = await useItemStore.getState().addItem({
      name: '测试自建条目',
      cycle: 'daily',
      gainKind: ['jade'],
    });
    expect(created?.origin).toBe('custom');
    const { items } = useItemStore.getState();
    expect(items.some((it) => it.id === created?.id)).toBe(true);
  });

  it('删除自建条目 → 真删（预设池里也不会有）', async () => {
    const created = await useItemStore.getState().addItem({
      name: '待删除条目',
      cycle: 'weekly',
      gainKind: [],
    });
    await useItemStore.getState().removeItem(created!.id);
    const { items, presetItems } = useItemStore.getState();
    expect(items.some((it) => it.id === created!.id)).toBe(false);
    expect(presetItems.some((it) => it.id === created!.id)).toBe(false);
  });

  it('恢复默认条目库 → 自建、隐藏、顺序一并清空', async () => {
    const seed = await api.listItems();
    await useItemStore.getState().addItem({ name: '临时条目', cycle: 'daily', gainKind: [] });
    await useItemStore.getState().hideItem('daily_pet');
    await useItemStore.getState().saveOrder(['daily_sign', 'daily_pet']);
    await useItemStore.getState().resetLibrary();

    const { overrides, items } = useItemStore.getState();
    expect(overrides).toMatchObject({ custom: [], hidden: [], order: [] });
    expect(items).toEqual(activeItems(seed, new Date()));
  });
});

describe('saveOrder：乐观更新 + 只写覆盖层分片', () => {
  it('本地顺序立即生效，且只写 yys:ovr:p_main', async () => {
    await useItemStore.getState().reloadItems();
    storage.clear();
    await useItemStore.getState().saveOrder(['daily_sign', 'daily_free_draw']);
    expect(useItemStore.getState().overrides?.order).toEqual(['daily_sign', 'daily_free_draw']);
    expect(storage.written).toEqual(['yys:ovr:p_main']);
  });

  it('写入失败 → 顺序回滚', async () => {
    await useItemStore.getState().reloadItems();
    const env = import.meta.env as unknown as Record<string, string | undefined>;
    env.VITE_API_FAIL = '1';
    try {
      await useItemStore.getState().saveOrder(['daily_sign']);
      expect(useItemStore.getState().overrides?.order).toEqual([]);
      expect(useItemStore.getState().error).toBeTruthy();
    } finally {
      delete env.VITE_API_FAIL;
    }
  });
});
