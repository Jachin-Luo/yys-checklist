/**
 * 御魂派生测试。
 *
 * 分两层：
 *   1. **内联固件** —— 精确覆盖四种数据形态（轮换 / 常驻 / 跟随 / 特殊）与边界（随机池误判）
 *   2. **真实种子** —— 经契约取 `yuhun` 库，锁定"周六周日是随机池""永生之海周日六种全"这类
 *      实测结论，数据改动导致语义漂移时会在这里报警
 */
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import type { Dungeon } from '../api/types';
import { dungeonDay, groupBySection, hasDayGrid, MODE_LABEL, oldFollowInfo, resolveFollow, WEEK_ORDER } from './yuhun';

const dg = (patch: Partial<Dungeon> & { id: string }): Dungeon => ({
  name: patch.id,
  mode: 'weekly',
  section: 'orochi',
  sort: 0,
  drops: [],
  ...patch,
});

describe('dungeonDay：当天掉什么', () => {
  const tips = [{ dungeonId: 'a', dow: 3, tip: '周三专属提示' }];

  it('轮换本取当天 dow 的名单，并带上当天提示', () => {
    const d = dg({ id: 'a', tip: '兜底提示', drops: [{ soulId: '破势', dow: 1 }, { soulId: '针女', dow: 3 }] });
    expect(dungeonDay(d, 3, tips)).toEqual({ souls: ['针女'], random: false, tip: '周三专属提示' });
  });

  it('没有当天提示时回落副本级 tip', () => {
    const d = dg({ id: 'a', tip: '兜底提示', drops: [{ soulId: '破势', dow: 1 }] });
    expect(dungeonDay(d, 1, tips).tip).toBe('兜底提示');
  });

  it('无 dow 的 drops 是常驻，任何一天都算', () => {
    const d = dg({ id: 'a', mode: 'fixed', drops: [{ soulId: '蜃气楼' }] });
    for (const dow of WEEK_ORDER) expect(dungeonDay(d, dow, tips).souls).toEqual(['蜃气楼']);
  });

  it('周末随机：当天无名单 + weekendRandom → random', () => {
    const d = dg({ id: 'a', weekendRandom: true, drops: [{ soulId: '破势', dow: 1 }] });
    expect(dungeonDay(d, 0, tips)).toEqual({ souls: [], random: true, tip: '' });
    expect(dungeonDay(d, 6, tips).random).toBe(true);
    expect(dungeonDay(d, 1, tips)).toEqual({ souls: ['破势'], random: false, tip: '' });
  });

  it('**边界**：当天无名单但没标 weekendRandom —— 是"这天不掉"，不是随机池', async () => {
    const d = dg({ id: 'a', drops: [{ soulId: '破势', dow: 1 }] });
    expect(dungeonDay(d, 0, tips)).toEqual({ souls: [], random: false, tip: '' });
  });

  it('特殊产出本：无掉落（由 reward 文本承载）', () => {
    const d = dg({ id: 'a', mode: 'special', reward: '首通 200 勾玉', drops: [] });
    expect(dungeonDay(d, 0, []).souls).toEqual([]);
    expect(MODE_LABEL[d.mode]).toBe('特殊产出');
  });
});

describe('hasDayGrid：要不要渲染 7 日条', () => {
  it('带 dow 的 drops → 渲染；全是常驻 → 不渲染', () => {
    expect(hasDayGrid(dg({ id: 'a', drops: [{ soulId: 'x', dow: 2 }] }))).toBe(true);
    expect(hasDayGrid(dg({ id: 'b', mode: 'fixed', drops: [{ soulId: 'x' }] }))).toBe(false);
    expect(hasDayGrid(dg({ id: 'c', mode: 'special', drops: [] }))).toBe(false);
  });
});

describe('跟随本', () => {
  const target = dg({ id: 'main', name: '八岐大蛇 1-10 层', weekendRandom: true, drops: [{ soulId: '破势', dow: 1 }] });
  const follower = dg({ id: 'sub', mode: 'follow', followId: 'main', drops: [{ soulId: '歌姬' }] });
  const oldFollower = dg({ id: 'sea', followOld: 'main', drops: [{ soulId: '遗念火', dow: 1 }] });
  const all = [target, follower, oldFollower];

  it('resolveFollow 指向被跟随副本', () => {
    expect(resolveFollow(follower, all)?.id).toBe('main');
    expect(resolveFollow(target, all)).toBeNull();
  });

  it('老魂跟随：取被跟随副本当天的名单（含随机态）', () => {
    expect(oldFollowInfo(oldFollower, all, [], 1)).toEqual({ name: '八岐大蛇 1-10 层', souls: ['破势'], random: false });
    expect(oldFollowInfo(oldFollower, all, [], 0)).toEqual({ name: '八岐大蛇 1-10 层', souls: [], random: true });
    expect(oldFollowInfo(target, all, [], 1)).toBeNull();
  });

  it('followOld 指向不存在的副本时不崩，返回 null', () => {
    const broken = dg({ id: 'x', followOld: 'nope' });
    expect(oldFollowInfo(broken, all, [], 1)).toBeNull();
  });
});

describe('groupBySection', () => {
  it('组内按 sort 升序', () => {
    const list = groupBySection([
      dg({ id: 'b', section: 'orochi', sort: 2 }),
      dg({ id: 'a', section: 'orochi', sort: 1 }),
      dg({ id: 'c', section: 'eien', sort: 5 }),
    ]);
    expect(list.map((g) => g.section)).toEqual(['orochi', 'eien']);
    expect(list[0].list.map((d) => d.id)).toEqual(['a', 'b']);
  });
});

describe('真实种子数据（防语义漂移）', () => {
  it('八岐系三个轮换本：工作日有 4/1 种名单，周六周日是随机池', async () => {
    const db = await api.getYuhun();
    const byId = new Map(db.dungeons.map((d) => [d.id, d]));

    const yama = byId.get('yama_1_10')!;
    expect(dungeonDay(yama, 1, db.dayTips).souls).toHaveLength(4);
    expect(dungeonDay(yama, 0, db.dayTips).random).toBe(true);
    expect(dungeonDay(yama, 6, db.dayTips).random).toBe(true);

    const bane = byId.get('yamata_no_orochi_bane')!;
    expect(dungeonDay(bane, 3, db.dayTips).souls).toHaveLength(1);
    expect(dungeonDay(bane, 0, db.dayTips).random).toBe(true);
  });

  it('永生之海：周六日六种全出、工作日只出 2 种，且老魂跟随魂十', async () => {
    const db = await api.getYuhun();
    const sea = db.dungeons.find((d) => d.id === 'eien_no_umi')!;
    expect(dungeonDay(sea, 0, db.dayTips).souls).toHaveLength(6);
    expect(dungeonDay(sea, 6, db.dayTips).souls).toHaveLength(6);
    expect(dungeonDay(sea, 0, db.dayTips).random).toBe(false);
    expect(dungeonDay(sea, 1, db.dayTips).souls).toHaveLength(2);
    expect(sea.followOld).toBe('yama_1_10');
    expect(oldFollowInfo(sea, db.dungeons, db.dayTips, 0)?.random).toBe(true);
  });

  it('日蚀/常驻本不渲染 7 日条；跟随本指向 魂十；真蛇无掉落但有 reward', async () => {
    const db = await api.getYuhun();
    const byId = new Map(db.dungeons.map((d) => [d.id, d]));
    expect(hasDayGrid(byId.get('nichirin')!)).toBe(false);
    expect(hasDayGrid(byId.get('nichirin_eclipse')!)).toBe(false);
    expect(hasDayGrid(byId.get('fuuma')!)).toBe(false);
    expect(resolveFollow(byId.get('gogyo_en')!, db.dungeons)?.id).toBe('yama_1_10');
    /* 逢魔 7 种：2026-09-11 补入十周年新增的 夜荒魂 */
    expect(byId.get('fuuma')!.drops.map((x) => x.soulId)).toContain('夜荒魂');
    /* 魂13·虚无 2026-09-11 起按星期轮换（原为「特殊产出 / 轮换待核」）：
       工作日各出 1 种专属、周末并入随机池 —— 全库保持 special 语义的只剩真·八岐大蛇 */
    const kyomu = byId.get('orochi_kyomu')!;
    expect(hasDayGrid(kyomu)).toBe(true);
    expect(dungeonDay(kyomu, 1, db.dayTips).souls).toEqual(['尘冢']);
    expect(dungeonDay(kyomu, 0, db.dayTips).random).toBe(true);
    const shin = byId.get('shin_orochi')!;
    expect(shin.drops).toHaveLength(0);
    expect(shin.reward).toBeTruthy();
  });

  it('分组完整：5 个 section 都有副本，且组内 sort 有序', async () => {
    const db = await api.getYuhun();
    const groups = groupBySection(db.dungeons);
    expect(groups.map((g) => g.section).sort()).toEqual(['eien', 'gogyo', 'nichirin', 'orochi', 'other']);
    for (const g of groups) {
      const sorts = g.list.map((d) => d.sort);
      expect(sorts).toEqual([...sorts].sort((a, b) => a - b));
    }
  });
});
