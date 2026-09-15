/**
 * 结界寄养时间测试。全部用**固定 now**，不依赖真实时间 —— 否则测试会在特定时刻随机失败。
 */
import { describe, expect, it } from 'vitest';
import {
  baseTsOf,
  clearPointDone,
  dueText,
  hmToDate,
  makeNurture,
  markPointDone,
  MAX_NURTURE_N,
  nextDue,
  nextPendingPoint,
  normalizeHM,
  nurturePoints,
  pointStats,
  recordPoints,
  sortNurture,
} from './nurture';

/** 2026-09-10（周四）14:00 */
const NOW = new Date(2026, 8, 10, 14, 0, 0);
/** 今天的某个时刻（时间戳） */
const at = (h: number, m = 0): number => new Date(2026, 8, 10, h, m).getTime();

describe('normalizeHM', () => {
  it('补零并校验范围', () => {
    expect(normalizeHM('9:05')).toBe('09:05');
    expect(normalizeHM('21:05')).toBe('21:05');
    expect(normalizeHM(' 23:59 ')).toBe('23:59');
  });

  it('非法输入返回 null（00:60 / 24:00 / 不补零的分钟 / 乱填）', () => {
    for (const bad of ['', 'abc', '24:00', '12:60', '9:5', '12-30']) expect(normalizeHM(bad)).toBeNull();
  });

  it('hmToDate：`HH:mm` → 今天的该时刻；非法 → null（实际完成时间输入用）', () => {
    expect(hmToDate('8:05', NOW)?.getTime()).toBe(at(8, 5));
    expect(hmToDate('乱填', NOW)).toBeNull();
  });
});

describe('nurturePoints：每 6h 推点（不含上卡点）', () => {
  it('从上卡时刻起推 n 个点，**不含上卡那一刻自身**', () => {
    const pts = nurturePoints('10:00', 4, NOW);
    expect(pts.map((p) => p.hm)).toEqual(['16:00', '22:00', '04:00', '10:00']);
    expect(pts.map((p) => p.index)).toEqual([1, 2, 3, 4]);
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

describe('recordPoints：上卡点 + 逐点递推（2026-09-15 重构）', () => {
  it('点列表以上卡点（index 0）打头，且它天然是已完成', () => {
    const r = makeNurture('08:00', 3, true, NOW);
    const pts = recordPoints(r, NOW);
    expect(pts.map((p) => p.index)).toEqual([0, 1, 2, 3]);
    expect(pts.map((p) => p.hm)).toEqual(['08:00', '14:00', '20:00', '02:00']);
    expect(pts[0].doneAt).toBe(at(8));
    expect(pts[1].doneAt).toBeUndefined();
  });

  it('给某个点记完成 → 只有它**之后**的点顺延，之前的原样不动', () => {
    const r = makeNurture('08:00', 3, true, NOW);
    /* 14:00 那个点实际 14:05 才收 */
    const done = markPointDone(r, 1, new Date(2026, 8, 10, 14, 5));
    const pts = recordPoints(done, NOW);

    expect(pts.map((p) => p.hm)).toEqual(['08:00', '14:00', '20:05', '02:05']);
    expect(pts[1].doneAt).toBe(new Date(2026, 8, 10, 14, 5).getTime());
    expect(pts[0].doneAt).toBe(at(8)); // 上卡点不受影响
    expect(pts[2].doneAt).toBeUndefined();
  });

  it('连续两个点各按自己的实际时间 → 后一个基于前一个的实际时间递推', () => {
    let r = makeNurture('08:00', 3, true, NOW);
    r = markPointDone(r, 1, new Date(2026, 8, 10, 14, 5));
    r = markPointDone(r, 2, new Date(2026, 8, 10, 20, 12));
    expect(recordPoints(r, NOW).map((p) => p.hm)).toEqual(['08:00', '14:00', '20:05', '02:12']);
  });

  it('取消某点的完成 → 后续回到"按预计时间推"', () => {
    const r = makeNurture('08:00', 3, true, NOW);
    const done = markPointDone(r, 1, new Date(2026, 8, 10, 14, 5));
    expect(recordPoints(done, NOW).map((p) => p.hm)).toEqual(['08:00', '14:00', '20:05', '02:05']);
    expect(recordPoints(clearPointDone(done, 1), NOW).map((p) => p.hm)).toEqual([
      '08:00',
      '14:00',
      '20:00',
      '02:00',
    ]);
  });

  it('上卡点不接受改写（index 0 由 base 决定）', () => {
    const r = makeNurture('08:00', 2, true, NOW);
    expect(markPointDone(r, 0, new Date(2026, 8, 10, 9, 30))).toEqual(r);
  });
});

describe('pointStats / nextPendingPoint', () => {
  it('统计已完成与待收（上卡点算已完成）', () => {
    const r = makeNurture('08:00', 3, true, NOW);
    expect(pointStats(recordPoints(r, NOW))).toEqual({ done: 1, pending: 3 });
    expect(pointStats(recordPoints(markPointDone(r, 1, new Date(2026, 8, 10, 14, 5)), NOW))).toEqual({
      done: 2,
      pending: 2,
    });
  });

  it('nextPendingPoint 取第一个未完成的收/续点（已过时间也算待办，不会跳过）', () => {
    const r = makeNurture('06:00', 3, true, NOW); // 12:00 / 18:00 / 00:00，其中 12:00 已过
    expect(nextPendingPoint(r, NOW)?.hm).toBe('12:00');

    const done = markPointDone(r, 1, new Date(2026, 8, 10, 12, 10));
    expect(nextPendingPoint(done, NOW)?.hm).toBe('18:10');
  });

  it('全部完成 → nextPendingPoint 为 null', () => {
    let r = makeNurture('08:00', 2, true, NOW);
    r = markPointDone(r, 1, new Date(2026, 8, 10, 14, 5));
    r = markPointDone(r, 2, new Date(2026, 8, 10, 20, 10));
    expect(nextPendingPoint(r, NOW)).toBeNull();
  });
});

describe('baseTsOf', () => {
  it('base 按今天解释；非法 base 回落到现在', () => {
    expect(baseTsOf({ base: '10:00' }, NOW)).toBe(at(10));
    expect(baseTsOf({ base: '乱填' }, NOW)).toBe(at(14));
  });
});

describe('nextDue / dueText：跨任务取最紧要的待办点（壳层徽章用）', () => {
  it('只算任务，取时间最早的那个未完成点（计划不参与）', () => {
    const early = makeNurture('08:00', 3, true, NOW); // 14:00 / 20:00 / 02:00
    const late = makeNurture('12:00', 3, true, NOW); // 18:00 / 00:00 / 06:00
    const plan = makeNurture('06:00', 3, false, NOW);

    const due = nextDue([late, plan, early], NOW);
    expect(due?.record.id).toBe(early.id);
    expect(due?.point.hm).toBe('14:00');
  });

  it('任务全部完成、或只有计划 → null', () => {
    let r = makeNurture('08:00', 1, true, NOW);
    r = markPointDone(r, 1, new Date(2026, 8, 10, 14, 5));
    expect(nextDue([r], NOW)).toBeNull();
    expect(nextDue([makeNurture('08:00', 3, false, NOW)], NOW)).toBeNull();
  });

  it('dueText：分 / 时:分 / 整点 / 到点即提醒', () => {
    const base = NOW.getTime();
    expect(dueText(base + 45 * 60000, NOW)).toBe('45 分');
    expect(dueText(base + (2 * 60 + 15) * 60000, NOW)).toBe('2h15m');
    expect(dueText(base + 120 * 60000, NOW)).toBe('2h');
    expect(dueText(base, NOW)).toBe('该收卡了');
    expect(dueText(base - 1000, NOW)).toBe('该收卡了');
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

  it('新记录没有完成记录；dones 只在记完成时出现', () => {
    const r = makeNurture('10:00', 4, true, NOW);
    expect(r.dones).toBeUndefined();
    expect(markPointDone(r, 1, NOW).dones).toEqual({ 1: NOW.getTime() });
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
