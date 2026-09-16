/**
 * 契约单测（设计文档 §9 S2 验收）：
 *   - 覆盖全部 ApiClient 方法（含 profile 全套）；
 *   - **分片写入验证：勾一条只改 `yys:state:{profileId}`**；
 *   - 越权校验（DataScope 显式带 userId 的价值）。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { MockApi } from './adapter';
import { resetStoreForTest } from './userStore';
import { KEY } from './persist';
import type { DataScope } from '../contract';
import { activeItems } from '../../domain/reset';
import { installMemoryStorage } from '../../test/memoryStorage';

/* ---------- localStorage 垫片（记录每一次 setItem，用于验证分片写入） ---------- */

const storage = installMemoryStorage();

const scope: DataScope = { userId: 'u_local', profileId: 'p_main' };
const api = new MockApi();

beforeEach(() => {
  storage.clear();
  resetStoreForTest();
});

describe('getBootstrap：首屏聚合（§3.3）', () => {
  it('一次返回 meta + items + session + state + view + overrides', async () => {
    const seed = await api.listItems();
    const b = await api.getBootstrap(scope);
    expect(b.meta.version).toBe('1.4.0');
    expect(b.meta.dicts.length).toBeGreaterThan(0);
    expect(b.meta.viewDefaults.minWeight).toBe(0);
    expect(seed.length).toBeGreaterThan(0);
    expect(b.items).toEqual(activeItems(seed, new Date()));
    expect(b.session).toEqual({ userId: 'u_local', profileId: 'p_main', authType: 'local' });
    expect(b.state.checked).toEqual({});
    expect(b.view.sortBy).toBe('weight');
    expect(b.overrides.custom).toEqual([]);
    /* 首屏只读，不产生任何写 */
    expect(storage.written).toEqual([]);
  });

  it('版本 / 赛季条目不受每日 0 点刷新影响（D2）', async () => {
    const b = await api.getBootstrap(scope);
    expect(b.meta.periods.version?.startAt).toBe('2026-09-09T09:00');
    expect(b.items.filter((i) => i.cycle === 'version').length).toBe(5);
  });
});

describe('勾选：增量写 + 分片验证（E-02 / §3.2）', () => {
  it('勾一条只写 yys:state:p_main，不触碰其它分片', async () => {
    const at = Date.now();
    await api.setChecked(scope, 'daily_sign', at);
    expect(storage.written).toEqual(['yys:state:p_main']);
    const s = await api.getState(scope);
    expect(s.checked.daily_sign).toBe(at);
  });

  it('取消勾选 = 删除该键，同样只写 state 分片', async () => {
    await api.setChecked(scope, 'daily_sign', Date.now());
    storage.written.length = 0;
    await api.setChecked(scope, 'daily_sign', null);
    expect(storage.written).toEqual(['yys:state:p_main']);
    const s = await api.getState(scope);
    expect(s.checked.daily_sign).toBeUndefined();
  });

  it('clearChecked 必传 itemIds；clearAllChecked 独立清空（K7）', async () => {
    const at = Date.now();
    await api.setChecked(scope, 'daily_sign', at);
    await api.setChecked(scope, 'daily_free_draw', at);
    await api.clearChecked(scope, ['daily_sign']);
    let s = await api.getState(scope);
    expect(s.checked).toEqual({ daily_free_draw: at });
    await api.clearAllChecked(scope);
    s = await api.getState(scope);
    expect(s.checked).toEqual({});
  });

  it('周期重置：daily 的过期勾选读取时归零；version 的保留', async () => {
    /* 读取时刻为真实 now：daily 起点 = 当天 0 点，09-09 的勾选必然早于它，故被归零 */
    const versionItem = { id: 'version_event_climb', cycle: 'version' as const };
    const dailyItem = { id: 'daily_sign', cycle: 'daily' as const };
    await api.setChecked(scope, versionItem.id, new Date(2026, 8, 9, 10).getTime());
    await api.setChecked(scope, dailyItem.id, new Date(2026, 8, 9, 3).getTime());
    const items = await api.listItems();
    const state = await api.getState(scope);
    expect(state.checked[versionItem.id]).toBeTruthy();
    expect(state.checked[dailyItem.id]).toBeUndefined();
    expect(items.some((i) => i.id === versionItem.id)).toBe(true);
  });
});

describe('视图 / 覆盖层：各自独立分片（D3）', () => {
  it('改排序只写 yys:view:p_main', async () => {
    const view = await api.getView(scope);
    storage.written.length = 0;
    await api.saveView(scope, { ...view, sortBy: 'name', minWeight: 20, showKinds: ['jade'] });
    expect(storage.written).toEqual(['yys:view:p_main']);
    const v = await api.getView(scope);
    expect(v.sortBy).toBe('name');
    expect(v.minWeight).toBe(20);
    expect(v.showKinds).toEqual(['jade']);
  });

  it('隐藏预设只进 hidden（软删），自建真删', async () => {
    await api.hideItem(scope, 'daily_sign');
    let ov = await api.getOverrides(scope);
    expect(ov.hidden).toEqual(['daily_sign']);
    let items = (await api.getBootstrap(scope)).items;
    expect(items.some((i) => i.id === 'daily_sign')).toBe(false);

    await api.restoreItem(scope, 'daily_sign');
    ov = await api.getOverrides(scope);
    expect(ov.hidden).toEqual([]);
    items = (await api.getBootstrap(scope)).items;
    expect(items.some((i) => i.id === 'daily_sign')).toBe(true);

    const custom = await api.addCustomItem(scope, {
      name: '测试自建条目', cycle: 'daily', gainKind: ['jade'],
    });
    expect(custom.id.startsWith('custom_')).toBe(true);
    expect(custom.origin).toBe('custom');
    await api.removeCustomItem(scope, custom.id);
    ov = await api.getOverrides(scope);
    expect(ov.custom).toEqual([]);
  });

  it('resetItemLibrary 清空自建与删除记录，但不动勾选状态', async () => {
    const at = Date.now();
    await api.hideItem(scope, 'daily_sign');
    await api.setChecked(scope, 'daily_sign', at);
    await api.resetItemLibrary(scope);
    const ov = await api.getOverrides(scope);
    expect(ov).toMatchObject({ custom: [], hidden: [], order: [] });
    const s = await api.getState(scope);
    expect(s.checked.daily_sign).toBe(at);
  });
});

describe('档案全套：大号 / 小号（§6）', () => {
  it('createProfile 初始化三份空数据且首个档案默认', async () => {
    const p = await api.createProfile('u_local', { name: '小号', server: '网易官服' });
    expect(p.isDefault).toBe(false);
    expect(p.sort).toBe(2);
    expect(await api.listProfiles('u_local')).toHaveLength(2);
    const b = await api.getBootstrap({ userId: 'u_local', profileId: p.id });
    expect(b.state.checked).toEqual({});
    expect(b.view.profileId).toBe(p.id);
  });

  it('switchProfile 只换 profileId，不涉及登录', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    const session = await api.switchProfile(p.id);
    expect(session.userId).toBe('u_local');
    expect(session.profileId).toBe(p.id);
  });

  it('勾选按档案隔离：两档案互不串', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    const atA = Date.now();
    const atB = Date.now() - 1;
    await api.setChecked(scope, 'daily_sign', atA);
    await api.setChecked({ userId: 'u_local', profileId: p.id }, 'daily_sign', atB);
    expect((await api.getState(scope)).checked.daily_sign).toBe(atA);
    expect((await api.getState({ userId: 'u_local', profileId: p.id })).checked.daily_sign).toBe(atB);
    expect(storage.getItem(KEY.state(p.id))).not.toBeNull();
  });

  it('删档连带清分片；禁止删最后一个；默认档案自动转移', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    await api.setChecked({ userId: 'u_local', profileId: p.id }, 'daily_sign', Date.now());
    await api.deleteProfile(scope, p.id);
    expect(await api.listProfiles('u_local')).toHaveLength(1);
    expect(storage.getItem(KEY.state(p.id))).toBeNull();

    await expect(api.deleteProfile(scope, 'p_main')).rejects.toThrow('至少保留一个档案');
  });

  it('updateProfile 设默认时取消其它默认', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    await api.updateProfile(p.id, { isDefault: true });
    const list = await api.listProfiles('u_local');
    expect(list.filter((x) => x.isDefault)).toHaveLength(1);
    expect(list.find((x) => x.id === p.id)?.isDefault).toBe(true);
  });
});

describe('越权与契约边界（§5.1）', () => {
  it('userId 与会话不符 → E_FORBIDDEN', async () => {
    await expect(
      api.setChecked({ userId: 'u_other', profileId: 'p_main' }, 'x', 1),
    ).rejects.toMatchObject({ code: 'E_FORBIDDEN' });
  });

  it('profileId 不属于该用户 → E_FORBIDDEN', async () => {
    await expect(
      api.getState({ userId: 'u_local', profileId: 'p_ghost' }),
    ).rejects.toMatchObject({ code: 'E_FORBIDDEN' });
  });

  it('listItems 支持按周期 / 类型 / 星期过滤', async () => {
    const daily = await api.listItems({ cycle: 'daily' });
    expect(daily.every((i) => i.cycle === 'daily')).toBe(true);
    const jade = await api.listItems({ kind: 'jade' });
    expect(jade.every((i) => (i.gainKind || []).includes('jade'))).toBe(true);
    const dow0 = await api.listItems({ dow: 0 });
    expect(dow0.every((i) => !i.days || i.days.includes(0))).toBe(true);
  });

  it('导入导出往返一致（S7）', async () => {
    const at = Date.now();
    await api.setChecked(scope, 'daily_sign', at);
    await api.hideItem(scope, 'daily_pet');
    const bundle = await api.exportUserData(scope);
    expect(bundle.schemaVersion).toBe('1.4.0');
    expect(bundle.profiles).toHaveLength(1);
    storage.clear();
    resetStoreForTest();
    await api.importUserData(scope, bundle);
    const s = await api.getState(scope);
    expect(s.checked.daily_sign).toBe(at);
    expect((await api.getOverrides(scope)).hidden).toEqual(['daily_pet']);
  });
});

describe('档案归档语义（§6.4）', () => {
  it('listProfiles 返回已归档档案（设置页才能"恢复"），但 switchProfile 拒绝切换', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    await api.updateProfile(p.id, { archived: true });

    const list = await api.listProfiles('u_local');
    expect(list.map((x) => x.id)).toContain(p.id);
    expect(list.find((x) => x.id === p.id)?.archived).toBe(true);

    await expect(api.switchProfile(p.id)).rejects.toThrow('已归档');
  });

  it('删除已归档档案不受"禁删最后一个"限制（存活档案数没变）', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    await api.updateProfile(p.id, { archived: true });
    await expect(api.deleteProfile(scope, p.id)).resolves.toBeUndefined();
    expect((await api.listProfiles('u_local')).some((x) => x.id === p.id)).toBe(false);
  });

  it('删除当前档案后，存活档案仍在且会话指针不再指向已删档案', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    await api.switchProfile(p.id);
    expect((await api.getSession()).profileId).toBe(p.id);

    await api.deleteProfile({ userId: 'u_local', profileId: p.id }, p.id);
    const list = await api.listProfiles('u_local');
    expect(list.map((x) => x.id)).toEqual(['p_main']);
    /* mock 内部已把会话指针落到存活档案，不会再指向已删档案 */
    const s = await api.getSession();
    expect(list.some((x) => x.id === s.profileId)).toBe(true);
  });
});

/* ── 档案级偏好分片（2026-09-16）─────────────────────────────────────────────
   寮时间与结界寄养任务由**设备级**升为**档案级**。这一组锁住四件事：
     ① 两个分片**按档案隔离**（换号看到的是各自的一份 —— 这是本次改动的全部意义）；
     ② 它们**随 bootstrap 下发**（壳层徽章与时间徽章不必再单独请求）；
     ③ 它们**随备份往返**（用户要求"所有配置项均可备份"，这是前提）；
     ④ 删档时**不留孤儿键**（`removeProfileShards` 漏掉新分片会攒垃圾）。
   另外补 `getCheckLog`：清单长按跨档案勾选时，靠它读**目标档案**的日志来合并新记录。 */
describe('档案级偏好分片（寮时间 / 寄养任务 / 日志读取）', () => {
  const p2scope = (profileId: string) => ({ userId: scope.userId, profileId });

  it('寮时间按档案隔离：一档一份，互不覆盖', async () => {
    const p2 = await api.createProfile(scope.userId, { name: '小号' });
    await api.saveGuildTime(scope, { daily_daoguan: '20:00' });
    await api.saveGuildTime(p2scope(p2.id), { daily_daoguan: '21:30', weekly_banquet: '20:30' });

    expect(await api.getGuildTime(scope)).toEqual({ daily_daoguan: '20:00' });
    expect(await api.getGuildTime(p2scope(p2.id))).toEqual({
      daily_daoguan: '21:30',
      weekly_banquet: '20:30',
    });
  });

  it('寄养任务按档案隔离（换号不会看到另一个号的寄养列表）', async () => {
    const p2 = await api.createProfile(scope.userId, { name: '小号' });
    const plan = { id: 'n_1', base: '08:00', n: 2, started: true, createdAt: 1, dones: { 1: 100 } };

    await api.savePlans(scope, [plan]);
    expect(await api.getPlans(scope)).toEqual([plan]);
    expect(await api.getPlans(p2scope(p2.id))).toEqual([]);
  });

  it('getBootstrap 一并带上两个新分片', async () => {
    await api.saveGuildTime(scope, { daily_daoguan: '20:00' });
    await api.savePlans(scope, [{ id: 'n_1', base: '08:00', n: 1, started: false, createdAt: 1 }]);

    const payload = await api.getBootstrap(scope);
    expect(payload.guildTime).toEqual({ daily_daoguan: '20:00' });
    expect(payload.plans).toHaveLength(1);
    expect(payload.plans[0].base).toBe('08:00');
  });

  it('导出带上两项；清库后导入原样还原', async () => {
    await api.saveGuildTime(scope, { daily_daoguan: '20:00' });
    await api.savePlans(scope, [{ id: 'n_1', base: '08:00', n: 2, started: true, createdAt: 1 }]);

    const bundle = await api.exportUserData(scope);
    expect(bundle.data[0].guildTime).toEqual({ daily_daoguan: '20:00' });
    expect(bundle.data[0].plans[0].id).toBe('n_1');

    storage.clear();
    resetStoreForTest();
    await api.importUserData(scope, bundle);

    expect(await api.getGuildTime(scope)).toEqual({ daily_daoguan: '20:00' });
    expect((await api.getPlans(scope))[0].base).toBe('08:00');
  });

  it('分片里的畸形寄养记录在**读取时**就被净化掉（base 非法会让递推算出 NaN）', async () => {
    /* 直接往分片里塞坏数据：模拟旧版本残留 / 被手工改坏 */
    storage.setItem('yys:plans:p_main', JSON.stringify([
      { id: 'n_ok', base: '08:00', n: 2, started: true, createdAt: 1 },
      { id: 'n_bad_base', base: '99:99', n: 1, started: true, createdAt: 1 },
      { id: 'n_bad_n', base: '08:00', n: 999, started: true, createdAt: 1 },
      { nope: true },
    ]));
    resetStoreForTest();

    const plans = await api.getPlans(scope);
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe('n_ok');
  });

  it('getCheckLog 读的是**传入 scope** 的日志，而不是当前档案的', async () => {
    const p2 = await api.createProfile(scope.userId, { name: '小号' });
    await api.saveCheckLog(p2scope(p2.id), {
      profileId: p2.id,
      userId: scope.userId,
      days: { '2026-09-16': ['daily_sign'] },
      updatedAt: '2026-09-16T00:00:00.000Z',
    });

    expect((await api.getCheckLog(p2scope(p2.id))).days['2026-09-16']).toEqual(['daily_sign']);
    expect((await api.getCheckLog(scope)).days).toEqual({});
  });

  it('删除档案时两个新分片一并清除（不留孤儿键）', async () => {
    const p2 = await api.createProfile(scope.userId, { name: '小号' });
    await api.saveGuildTime(p2scope(p2.id), { daily_daoguan: '20:00' });
    await api.savePlans(p2scope(p2.id), [{ id: 'n_1', base: '08:00', n: 1, started: false, createdAt: 1 }]);

    await api.deleteProfile(scope, p2.id);
    expect(storage.getItem(`yys:guild:${p2.id}`)).toBeNull();
    expect(storage.getItem(`yys:plans:${p2.id}`)).toBeNull();
  });
});
