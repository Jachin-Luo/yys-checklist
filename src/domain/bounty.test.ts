/**
 * 悬赏派生测试：四表 join、交集搜索、并集推荐。
 * 内联固件覆盖精确行为，真实种子锁定既知结论（39 式神 / 零孤儿 / 大天狗的线索词）。
 */
import { describe, expect, it } from 'vitest';
import { api } from '../api';
import type { BountyDb } from '../api/types';
import { bountyUnion, buildBountyEntries, fullCoverage, matchBounty, pinMatches } from './bounty';

const db: BountyDb = {
  shikigami: [
    { id: '大天狗', name: '大天狗' },
    { id: '鬼使黑', name: '鬼使黑' },
    { id: '座敷童子', name: '座敷童子' },
  ],
  spots: [
    { id: '第15章', name: '第15章', kind: '探索章节' },
    { id: '御魂4层', name: '御魂4层', kind: '御魂层' },
    { id: '暴风之巅', name: '暴风之巅', kind: '秘闻副本' },
  ],
  shikigamiSpots: [
    { shikigamiId: '大天狗', spotId: '第15章', count: 1 },
    { shikigamiId: '大天狗', spotId: '御魂4层', count: 2 },
    { shikigamiId: '大天狗', spotId: '暴风之巅', count: 1 },
    { shikigamiId: '鬼使黑', spotId: '第15章', count: 3 },
    { shikigamiId: '鬼使黑', spotId: '御魂4层', count: 1 },
    /* 座敷童子只在暴风之巅 —— 用来验证"没有共同出处"时的排序 */
    { shikigamiId: '座敷童子', spotId: '暴风之巅', count: 5 },
  ],
  shikigamiClues: [
    { shikigamiId: '大天狗', word: '羽毛' },
    { shikigamiId: '大天狗', word: '扇' },
    { shikigamiId: '鬼使黑', word: '黑衣' },
    { shikigamiId: '座敷童子', word: '坐敷' },
  ],
};

describe('buildBountyEntries：四表 join', () => {
  const entries = buildBountyEntries(db);

  it('每行都带上线索与出处（含击杀数）', () => {
    const dog = entries.find((e) => e.id === '大天狗')!;
    expect(dog.clues).toEqual(['羽毛', '扇']);
    expect(dog.spots).toEqual([
      { spotId: '第15章', name: '第15章', kind: '探索章节', count: 1 },
      { spotId: '御魂4层', name: '御魂4层', kind: '御魂层', count: 2 },
      { spotId: '暴风之巅', name: '暴风之巅', kind: '秘闻副本', count: 1 },
    ]);
  });

  it('孤儿关联被跳过，不会渲染出空名出处', () => {
    const dirty: BountyDb = { ...db, shikigamiSpots: [...db.shikigamiSpots, { shikigamiId: '大天狗', spotId: '不存在', count: 1 }] };
    const dog = buildBountyEntries(dirty).find((e) => e.id === '大天狗')!;
    expect(dog.spots.some((s) => s.name === '不存在')).toBe(false);
    expect(dog.spots).toHaveLength(3);
  });

  it('没有线索/出处的式神返回空数组而不是 undefined', () => {
    const lonely: BountyDb = { shikigami: [{ id: '独行', name: '独行' }], spots: [], shikigamiSpots: [], shikigamiClues: [] };
    expect(buildBountyEntries(lonely)[0]).toMatchObject({ clues: [], spots: [] });
  });
});

describe('matchBounty：空格分词取交集', () => {
  const entries = buildBountyEntries(db);

  it('空查询返回空（不铺全量）', () => {
    expect(matchBounty(entries, '')).toEqual([]);
    expect(matchBounty(entries, '   ')).toEqual([]);
  });

  it('按式神名直接搜', () => {
    expect(matchBounty(entries, '鬼使').map((e) => e.id)).toEqual(['鬼使黑']);
  });

  it('按线索词搜（神秘妖怪反查）', () => {
    expect(matchBounty(entries, '羽毛').map((e) => e.id)).toEqual(['大天狗']);
  });

  it('两个词取**交集**：羽毛+扇 命中同一个，羽毛+黑衣 命中不了任何一个', () => {
    expect(matchBounty(entries, '羽毛 扇').map((e) => e.id)).toEqual(['大天狗']);
    expect(matchBounty(entries, '羽毛 黑衣')).toEqual([]);
  });

  it('线索词反向包含也算命中（用户只记得半个词）', () => {
    expect(matchBounty(entries, '扇子').map((e) => e.id)).toEqual(['大天狗']);
  });
});

describe('pinMatches：搜索只置顶、不过滤', () => {
  const entries = buildBountyEntries(db);

  it('**一行都不删**：完整名单始终在（用户要能边搜边挑别的）', () => {
    const ranked = pinMatches(entries, '羽毛');
    expect(ranked).toHaveLength(entries.length);
    expect(new Set(ranked.map((e) => e.id))).toEqual(new Set(entries.map((e) => e.id)));
  });

  it('匹配项置顶并标记 hit，其余保持原顺序', () => {
    const ranked = pinMatches(entries, '羽毛');
    expect(ranked[0].id).toBe('大天狗');
    expect(ranked[0].hit).toBe(true);
    /* 非匹配项的相对顺序 = 原顺序（去掉匹配项后应完全一致） */
    expect(ranked.filter((e) => !e.hit).map((e) => e.id)).toEqual(
      entries.filter((e) => e.id !== '大天狗').map((e) => e.id),
    );
  });

  it('两个词取交集时只置顶交集结果', () => {
    expect(pinMatches(entries, '羽毛 扇').filter((e) => e.hit).map((e) => e.id)).toEqual(['大天狗']);
    expect(pinMatches(entries, '羽毛 黑衣').filter((e) => e.hit)).toEqual([]);
  });

  it('一个都没匹配上时名单依然完整（由 UI 给提示，而不是换成空态）', () => {
    const ranked = pinMatches(entries, '不存在的妖怪名');
    expect(ranked).toHaveLength(entries.length);
    expect(ranked.every((e) => !e.hit)).toBe(true);
  });

  it('无查询：全部 hit=false 且**保持原顺序**（没有搜索就不该有"更相关"）', () => {
    const ranked = pinMatches(entries, '   ');
    expect(ranked.map((e) => e.id)).toEqual(entries.map((e) => e.id));
    expect(ranked.every((e) => !e.hit)).toBe(true);
  });

  it('不修改入参（返回新数组与新对象）', () => {
    const before = entries.map((e) => e.id);
    const ranked = pinMatches(entries, '羽毛');
    expect(entries.map((e) => e.id)).toEqual(before);
    expect(ranked[0]).not.toBe(entries.find((e) => e.id === ranked[0].id));
  });
});

describe('bountyUnion：并集推荐', () => {
  const entries = buildBountyEntries(db);

  it('空选返回空', () => {
    expect(bountyUnion(entries, [])).toEqual([]);
  });

  it('能一次刷完全部的排最前，其余按覆盖数降序', () => {
    const rows = bountyUnion(entries, ['大天狗', '鬼使黑']);
    /* 第15章 / 御魂4层 覆盖 2 个 → full，排前面；暴风之巅只覆盖 1 个 → 排后面 */
    expect(rows.map((r) => r.spotId)).toEqual(['第15章', '御魂4层', '暴风之巅']);
    expect(rows.map((r) => r.full)).toEqual([true, true, false]);
    expect(rows[0].hits.map((h) => h.name)).toEqual(['大天狗', '鬼使黑']);
  });

  it('fullCoverage 只认能全收 **且覆盖多个** 的出处', () => {
    expect(fullCoverage(bountyUnion(entries, ['大天狗', '鬼使黑'])).map((r) => r.spotId)).toEqual(['第15章', '御魂4层']);
    /* 只选一个式神时"处处都算全收"，此时不该给"有戏"结论 */
    expect(fullCoverage(bountyUnion(entries, ['大天狗']))).toEqual([]);
  });

  it('已选式神没有共同出处时，仍按覆盖数给出优先顺序（含座敷童子的那处只有一个）', () => {
    const rows = bountyUnion(entries, ['大天狗', '座敷童子']);
    expect(rows[0].spotId).toBe('暴风之巅');
    expect(rows[0].full).toBe(true);
    expect(rows.filter((r) => r.full)).toHaveLength(1);
  });
});

describe('真实种子数据（防语义漂移）', () => {
  it('39 式神全部能 join 出处与线索，零孤儿', async () => {
    const entries = buildBountyEntries(await api.getBounty());
    expect(entries).toHaveLength(39);
    expect(entries.every((e) => e.spots.length > 0)).toBe(true);
    expect(entries.every((e) => e.clues.length > 0)).toBe(true);
  });

  it('大天狗可用「羽毛 扇」反查到', async () => {
    const entries = buildBountyEntries(await api.getBounty());
    expect(matchBounty(entries, '羽毛 扇').map((e) => e.id)).toContain('大天狗');
  });

  it('并集结果满足不变量：full 与覆盖数一致、排序不出现"非全收在前"', async () => {
    const entries = buildBountyEntries(await api.getBounty());
    const pick = entries.slice(0, 3).map((e) => e.id);
    const rows = bountyUnion(entries, pick);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.full).toBe(r.hits.length === pick.length);
      expect(r.hits.length).toBeGreaterThanOrEqual(1);
      expect(r.hits.length).toBeLessThanOrEqual(pick.length);
    }
    const firstNonFull = rows.findIndex((r) => !r.full);
    if (firstNonFull >= 0) expect(rows.slice(firstNonFull).every((r) => !r.full)).toBe(true);
  });
});
