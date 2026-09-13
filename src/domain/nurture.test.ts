/**
 * 结界寄养时间测试。全部用**固定 now**，不依赖真实时间 —— 否则测试会在特定时刻随机失败。
 */
import { describe, expect, it } from 'vitest';
import { makeNurture, MAX_NURTURE_N, nextPointIndex, normalizeHM, nurturePoints, pointStats, sortNurture } from './nurture';

/** 2026-09-10（周四）14:00 */
const NOW = new Date(2026, 8, 10, 14, 0, 0);

describe('normalizeHM', () => {
  it('补零并校验范围', () => {
    expect(normalizeHM('9:05')).toBe('09:05');
    expect(normalizeHM('21:05')).toBe('21:05');
    expect(normalizeHM(' 23:59 ')).toBe('23:59');
  });

  it('非法输入返回 null（00:60 / 24:00 / 不补零的分钟 / 乱填）', () => {
    for (const bad of ['', 'abc', '24:00', '12:60', '9:5', '12-30']) expect(normalizeHM(bad)).toBeNull();
  });
});

describe('nurturePoints：每 6h 推点', () => {
  it('从上卡时刻起推 n 个点，**不含上卡那一刻自身**', () => {
    const pts = nurturePoints('10:00', 4, NOW);
    expect(pts.map((p) => p.hm)).toEqual(['16:00', '22:00', '04:00', '10:00']);
  });

  it('跨天自动标 明天 / 后天', () => {
    expect(nurturePoints('10:00', 4, NOW).map((p) => p.dayLabel)).toEqual(['今天', '今天', '明天', '明天']);
    /* 18:00 上卡推到第 5 点正好跨到后天 */
    expect(nurturePoints('18:00', MAX_NURTURE_N, NOW).map((p) => p.dayLabel)).toEqual([
      '明天',
      '明天',
      '明天',
      '明天',
      '后天',
    ]);
  });

  it('已过 / 未到按 now 判定；**同刻算未到**（那一点正是现在要做的事）', () => {
    const pts = nurturePoints('10:00', 4, NOW);
    expect(pts.map((p) => p.past)).toEqual([false, false, false, false]);

    const early = nurturePoints('02:00', 3, NOW);
    expect(early.map((p) => p.hm)).toEqual(['08:00', '14:00', '20:00']);
    expect(early.map((p) => p.past)).toEqual([true, false, false]);
    expect(nextPointIndex(early)).toBe(1);
  });

  it('非法上卡时间回落到"现在"，不抛错', () => {
    const pts = nurturePoints('乱填', 2, NOW);
    /* 14:00 → 20:00 / 次日 02:00 */
    expect(pts.map((p) => p.hm)).toEqual(['20:00', '02:00']);
  });

  it('n=0 返回空数组（不生成上卡时刻）', () => {
    expect(nurturePoints('10:00', 0, NOW)).toEqual([]);
  });
});

describe('pointStats / nextPointIndex', () => {
  it('统计已过与未到', () => {
    const pts = nurturePoints('02:00', 3, NOW);
    expect(pointStats(pts)).toEqual({ past: 1, future: 2 });
  });

  it('全部已过 → nextPointIndex = -1', () => {
    const pts = nurturePoints('00:00', 2, NOW);
    expect(pts.every((p) => p.past)).toBe(true);
    expect(nextPointIndex(pts)).toBe(-1);
  });
});

describe('makeNurture / sortNurture', () => {
  it('归一化 base、夹紧 n、id 唯一', () => {
    const a = makeNurture('9:05', 9, true, NOW);
    const b = makeNurture('9:05', -3, false, NOW);
    expect(a.base).toBe('09:05');
    expect(a.n).toBe(MAX_NURTURE_N);
    expect(b.n).toBe(1);
    expect(a.id).not.toBe(b.id);
  });

  it('非法 base 回落到当前时刻', () => {
    expect(makeNurture('乱填', 4, true, NOW).base).toBe('14:00');
  });

  it('任务在前、计划在后，各自按创建时间倒序', () => {
    const recs = [
      makeNurture('10:00', 4, false, new Date(2026, 8, 10, 10, 0)),
      makeNurture('11:00', 4, true, new Date(2026, 8, 10, 11, 0)),
      makeNurture('12:00', 4, true, new Date(2026, 8, 10, 12, 0)),
    ];
    const sorted = sortNurture(recs);
    expect(sorted.map((r) => r.base)).toEqual(['12:00', '11:00', '10:00']);
    expect(sorted.map((r) => r.started)).toEqual([true, true, false]);
  });
});
