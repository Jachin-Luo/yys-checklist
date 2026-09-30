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
import { draftFromItem } from '../../domain/itemDraft';
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
    expect(b.view.sortBy).toBe('db');
    expect(b.overrides.custom).toEqual([]);
    /* 首屏只读，不产生任何写 */
    expect(storage.written).toEqual([]);
  });

  it('周期字典收口为四类，条目侧不再出现已删除的周期（2026-09-28）', async () => {
    const b = await api.getBootstrap(scope);
    const cycles = b.meta.dicts.filter((d) => d.type === 'cycle').map((d) => d.code);
    expect(cycles).toEqual(['daily', 'weekly', 'monthly', 'limited']);
    /* `version` / `season` / `once` 都已从枚举删除：条目里不该再有任何一条带着它们 */
    for (const it of b.items) expect(cycles).toContain(it.cycle);
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

  it('周期重置：daily 的过期勾选读取时归零；limited 的保留', async () => {
    /* 读取时刻为真实 now：daily 起点 = 当天 0 点，09-09 的勾选必然早于它，故被归零 */
    const items = await api.listItems();
    /* 「保留」这一侧取一条**真实存在**的 limited 条目：2026-09-28 起 version / season
       并入 limited，这一类不按周期翻篇、只靠 `until` 归档（见 `domain/reset` 的周期表），
       故旧勾选仍在。原先写死 `version_event_climb` —— 那条已随本次清理删除，而**写死 id
       等于让测试去断言数据里有没有这条**，数据一动就把测试变成假红，故改为从当前数据取。
       取**非子组**的：多次任务的勾选键空间是子步骤 id、父 id 不自勾（见 `domain/steps.stepIds`），
       勾父 id 会被 `mergeChecked` 当孤儿清掉 —— 那是设计而非 bug */
    const keepItem = items.find((i) => i.cycle === 'limited' && !i.children?.length)!;
    const dailyItem = { id: 'daily_sign', cycle: 'daily' as const };
    await api.setChecked(scope, keepItem.id, new Date(2026, 8, 9, 10).getTime());
    await api.setChecked(scope, dailyItem.id, new Date(2026, 8, 9, 3).getTime());
    const state = await api.getState(scope);
    expect(state.checked[keepItem.id]).toBeTruthy();
    expect(state.checked[dailyItem.id]).toBeUndefined();
    expect(items.some((i) => i.id === keepItem.id)).toBe(true);
  });
});

describe('视图 / 覆盖层：各自独立分片（D3）', () => {
  it('改排序只写 yys:view:p_main', async () => {
    const view = await api.getView(scope);
    storage.written.length = 0;
    await api.saveView(scope, { ...view, sortBy: 'name', minWeight: 20 });
    expect(storage.written).toEqual(['yys:view:p_main']);
    const v = await api.getView(scope);
    expect(v.sortBy).toBe('name');
    expect(v.minWeight).toBe(20);
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

  it('自建条目可改写字段（2026-09-28 新增）：id / origin 不变，勾选与顺序不受影响', async () => {
    const at = Date.now();
    const custom = await api.addCustomItem(scope, {
      name: '旧名字', cycle: 'daily', gainKind: ['jade'], deadline: '2026-10-06', note: '旧备注',
    });
    await api.setChecked(scope, custom.id, at);

    const updated = await api.updateItem(scope, custom.id, {
      name: '新名字', cycle: 'monthly', gainKind: [],
      /* 刻意不给 deadline / note：**整体覆盖**语义下，草稿没给的字段就是清掉 */
    });
    expect(updated.id).toBe(custom.id);
    expect(updated.origin).toBe('custom');
    expect(updated.name).toBe('新名字');
    expect(updated.cycle).toBe('monthly');
    expect(updated.deadline).toBeUndefined();
    expect(updated.note).toBeUndefined();
    /* 空 gainKind 归 undefined（不是空数组）—— 见 `domain/itemDraft` */
    expect(updated.gainKind).toBeUndefined();

    const ov = await api.getOverrides(scope);
    expect(ov.custom).toHaveLength(1);
    expect(ov.custom[0].name).toBe('新名字');
    /* 编辑不该动"做没做过" */
    expect((await api.getState(scope)).checked[custom.id]).toBe(at);
  });

  it('预设条目可编辑：写一层字段改写，种子不动、清空生效（2026-09-28）', async () => {
    const seed = (await api.listItems()).find((i) => i.id === 'daily_sign')!;

    const updated = await api.updateItem(scope, 'daily_sign', {
      name: '我的签到', cycle: 'daily', gainKind: [],
      /* 种子里有 note 而这里不给 → 改写里落成 `null`（显式清空） */
    });
    expect(updated.id).toBe('daily_sign');
    expect(updated.origin).toBe('preset');
    expect(updated.name).toBe('我的签到');
    expect(updated.note).toBeUndefined();

    /* 覆盖层里记的是**差异**，不是整条：只出现变了的字段
       （seed 里 name / note / path / gainKind 都有值，草稿一个都没给 → 四个都落成 null） */
    const patch = (await api.getOverrides(scope)).patches?.daily_sign;
    expect(Object.keys(patch ?? {}).sort()).toEqual(['gainKind', 'name', 'note', 'path']);
    expect(patch?.note).toBeNull();
    /* 种子本身没被改（`listItems` 返回的是纯种子） */
    expect((await api.listItems()).find((i) => i.id === 'daily_sign')!.name).toBe(seed.name);

    /* 生效数据：改写的字段按改写走，**没动到的字段沿用种子**（`autoDaily` 就属于没动到的） */
    const live = (await api.getBootstrap(scope)).items.find((i) => i.id === 'daily_sign')!;
    expect(live.name).toBe('我的签到');
    expect(live.cycle).toBe(seed.cycle);
    expect(live.autoDaily).toBe(true);

    /* 改回原样 → 差异为空 → 改写被删掉（"编辑回原样 = 没改过"）。
       走 `draftFromItem(seed)`，与 UI 的「还原默认」同一路径 */
    await api.updateItem(scope, 'daily_sign', draftFromItem(seed));
    expect((await api.getOverrides(scope)).patches?.daily_sign).toBeUndefined();
  });

  it('加子步骤后读回来步数不变（2026-09-28 修：不合规的 id 曾被静默丢弃）', async () => {
    const seed = (await api.listItems()).find((i) => i.id === 'daily_sign')!;
    /* 这三个是**表单真实会生成的形态**：`nanoid(6)` 默认字母表含大写与 `-`。
       此前写进分片是 3 步、读回来是 0 步 —— "改成 N 个子条目没生效"，且没有任何报错 */
    const subs = [{ id: 'sub_DvBaJW' }, { id: 'sub_zz-99' }, { id: 'sub_ok01' }];
    await api.updateItem(scope, 'daily_sign', { ...draftFromItem(seed), children: subs } as never);

    const live = (await api.getBootstrap(scope)).items.find((i) => i.id === 'daily_sign')!;
    expect(live.children).toHaveLength(3);
  });

  it('改写不存在的 id 报 E_NOT_ITEM', async () => {
    await expect(
      api.updateItem(scope, 'no_such_item', { name: '幽灵条目', cycle: 'daily', gainKind: [] }),
    ).rejects.toMatchObject({ code: 'E_NOT_ITEM' });
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

describe('账号全套：大号 / 小号（§6）', () => {
  it('createProfile 初始化三份空数据且首个账号默认', async () => {
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

  it('勾选按账号隔离：两账号互不串', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    const atA = Date.now();
    const atB = Date.now() - 1;
    await api.setChecked(scope, 'daily_sign', atA);
    await api.setChecked({ userId: 'u_local', profileId: p.id }, 'daily_sign', atB);
    expect((await api.getState(scope)).checked.daily_sign).toBe(atA);
    expect((await api.getState({ userId: 'u_local', profileId: p.id })).checked.daily_sign).toBe(atB);
    expect(storage.getItem(KEY.state(p.id))).not.toBeNull();
  });

  it('删档连带清分片；禁止删最后一个；默认账号自动转移', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    await api.setChecked({ userId: 'u_local', profileId: p.id }, 'daily_sign', Date.now());
    await api.deleteProfile(scope, p.id);
    expect(await api.listProfiles('u_local')).toHaveLength(1);
    expect(storage.getItem(KEY.state(p.id))).toBeNull();

    await expect(api.deleteProfile(scope, 'p_main')).rejects.toThrow('至少保留一个账号');
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

describe('账号归档语义（§6.4）', () => {
  it('listProfiles 返回已归档账号（设置页才能"恢复"），但 switchProfile 拒绝切换', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    await api.updateProfile(p.id, { archived: true });

    const list = await api.listProfiles('u_local');
    expect(list.map((x) => x.id)).toContain(p.id);
    expect(list.find((x) => x.id === p.id)?.archived).toBe(true);

    await expect(api.switchProfile(p.id)).rejects.toThrow('已归档');
  });

  it('删除已归档账号不受"禁删最后一个"限制（存活账号数没变）', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    await api.updateProfile(p.id, { archived: true });
    await expect(api.deleteProfile(scope, p.id)).resolves.toBeUndefined();
    expect((await api.listProfiles('u_local')).some((x) => x.id === p.id)).toBe(false);
  });

  it('删除当前账号后，存活账号仍在且会话指针不再指向已删账号', async () => {
    const p = await api.createProfile('u_local', { name: '小号' });
    await api.switchProfile(p.id);
    expect((await api.getSession()).profileId).toBe(p.id);

    await api.deleteProfile({ userId: 'u_local', profileId: p.id }, p.id);
    const list = await api.listProfiles('u_local');
    expect(list.map((x) => x.id)).toEqual(['p_main']);
    /* mock 内部已把会话指针落到存活账号，不会再指向已删账号 */
    const s = await api.getSession();
    expect(list.some((x) => x.id === s.profileId)).toBe(true);
  });
});

/* ── 账号级偏好分片（2026-09-16）─────────────────────────────────────────────
   寮时间与结界寄养任务由**设备级**升为**账号级**。这一组锁住四件事：
     ① 两个分片**按账号隔离**（换号看到的是各自的一份 —— 这是本次改动的全部意义）；
     ② 它们**随 bootstrap 下发**（壳层徽章与时间徽章不必再单独请求）；
     ③ 它们**随备份往返**（用户要求"所有配置项均可备份"，这是前提）；
     ④ 删档时**不留孤儿键**（`removeProfileShards` 漏掉新分片会攒垃圾）。
   另外补 `getCheckLog`：清单长按跨账号勾选时，靠它读**目标账号**的日志来合并新记录。 */
describe('账号级偏好分片（寮时间 / 寄养任务 / 日志读取）', () => {
  const p2scope = (profileId: string) => ({ userId: scope.userId, profileId });

  it('寮时间按账号隔离：一档一份，互不覆盖', async () => {
    const p2 = await api.createProfile(scope.userId, { name: '小号' });
    await api.saveGuildTime(scope, { daily_daoguan: '20:00' });
    await api.saveGuildTime(p2scope(p2.id), { daily_daoguan: '21:30', weekly_banquet: '20:30' });

    expect(await api.getGuildTime(scope)).toEqual({ daily_daoguan: '20:00' });
    expect(await api.getGuildTime(p2scope(p2.id))).toEqual({
      daily_daoguan: '21:30',
      weekly_banquet: '20:30',
    });
  });

  it('寄养任务按账号隔离（换号不会看到另一个号的寄养列表）', async () => {
    const p2 = await api.createProfile(scope.userId, { name: '小号' });
    const plan = { id: 'n_1', base: '08:00', hours: 12, delay: 0, started: true, createdAt: 1, dones: { 1: 100 } };

    await api.savePlans(scope, [plan]);
    expect(await api.getPlans(scope)).toEqual([plan]);
    expect(await api.getPlans(p2scope(p2.id))).toEqual([]);
  });

  it('getBootstrap 一并带上两个新分片', async () => {
    await api.saveGuildTime(scope, { daily_daoguan: '20:00' });
    await api.savePlans(scope, [{ id: 'n_1', base: '08:00', hours: 6, delay: 0, started: false, createdAt: 1 }]);

    const payload = await api.getBootstrap(scope);
    expect(payload.guildTime).toEqual({ daily_daoguan: '20:00' });
    expect(payload.plans).toHaveLength(1);
    expect(payload.plans[0].base).toBe('08:00');
  });

  it('导出带上两项；清库后导入原样还原', async () => {
    await api.saveGuildTime(scope, { daily_daoguan: '20:00' });
    await api.savePlans(scope, [{ id: 'n_1', base: '08:00', hours: 12, delay: 0, started: true, createdAt: 1 }]);

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
      { id: 'n_ok', base: '08:00', hours: 12, delay: 5, started: true, createdAt: 1 },
      { id: 'n_bad_base', base: '99:99', hours: 6, delay: 0, started: true, createdAt: 1 },
      { id: 'n_bad_hours', base: '08:00', hours: 999, delay: 0, started: true, createdAt: 1 },
      /* 延迟离谱记录：夹紧而不是丢弃（它是可选细节，0 也合法） */
      { id: 'n_delay_clamped', base: '08:00', hours: 12, delay: 999, started: true, createdAt: 1 },
      { nope: true },
    ]));
    resetStoreForTest();

    const plans = await api.getPlans(scope);
    /* `n_ok` 与 `n_delay_clamped` 留下；base / hours 非法的两条被丢弃 */
    expect(plans.map((p) => p.id)).toEqual(['n_ok', 'n_delay_clamped']);
    expect(plans[0].delay).toBe(5);
    /* 离谱延迟是**夹紧**而不是丢弃：它是可选细节，0 也合法，没必要为此废掉整条记录 */
    expect(plans[1].delay).toBe(60);
  });

  it('getCheckLog 读的是**传入 scope** 的日志，而不是当前账号的', async () => {
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

  it('删除账号时两个新分片一并清除（不留孤儿键）', async () => {
    const p2 = await api.createProfile(scope.userId, { name: '小号' });
    await api.saveGuildTime(p2scope(p2.id), { daily_daoguan: '20:00' });
    await api.savePlans(p2scope(p2.id), [{ id: 'n_1', base: '08:00', hours: 6, delay: 0, started: false, createdAt: 1 }]);

    await api.deleteProfile(scope, p2.id);
    expect(storage.getItem(`yys:guild:${p2.id}`)).toBeNull();
    expect(storage.getItem(`yys:plans:${p2.id}`)).toBeNull();
  });
});
