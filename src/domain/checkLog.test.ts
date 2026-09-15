import { describe, expect, it } from 'vitest';
import {
  addEntry,
  dayCount,
  dayKey,
  dayKeyOf,
  eachDay,
  keyToTs,
  LOG_KEEP_DAYS,
  pruneDays,
  removeEntriesSince,
  removeEntrySince,
  shiftDayKey,
} from './checkLog';

/** 本地时区固定时刻，避免 UTC 偏移把日期翻到前一天 */
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('dayKey / keyToTs / shiftDayKey', () => {
  it('时间戳 → 本地日期键', () => {
    expect(dayKeyOf(at(2026, 9, 15))).toBe('2026-09-15');
    expect(dayKey(new Date(2026, 8, 1))).toBe('2026-09-01');
  });

  it('日期键 → 当天 0 点；非法返回 null', () => {
    expect(keyToTs('2026-09-15')).toBe(new Date(2026, 8, 15, 0, 0, 0, 0).getTime());
    expect(keyToTs('2026-9-15')).toBeNull();
    expect(keyToTs('乱填')).toBeNull();
  });

  it('± 天跨月 / 跨年；非法键原样返回', () => {
    expect(shiftDayKey('2026-09-01', -1)).toBe('2026-08-31');
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDayKey('乱填', 1)).toBe('乱填');
  });
});

describe('addEntry：幂等', () => {
  it('同日同条不重复记；不同日各记一条', () => {
    let days = addEntry({}, 'daily_sign', at(2026, 9, 15, 8));
    days = addEntry(days, 'daily_sign', at(2026, 9, 15, 20));
    expect(days).toEqual({ '2026-09-15': ['daily_sign'] });

    days = addEntry(days, 'daily_sign', at(2026, 9, 16, 8));
    expect(days).toEqual({ '2026-09-15': ['daily_sign'], '2026-09-16': ['daily_sign'] });
  });

  it('同一天多条并存', () => {
    const days = addEntry(addEntry({}, 'a', at(2026, 9, 15)), 'b', at(2026, 9, 15, 23));
    expect(days['2026-09-15']).toEqual(['a', 'b']);
  });

  it('无变化时返回原对象（上层可据此做引用比较）', () => {
    const days = addEntry({}, 'a', at(2026, 9, 15));
    expect(addEntry(days, 'a', at(2026, 9, 15, 23))).toBe(days);
  });
});

describe('removeEntrySince：只回退本周期', () => {
  const periodStart = at(2026, 9, 15, 0);

  it('移除起点之后的记录，之前的保留', () => {
    const days = {
      '2026-09-13': ['daily_sign'],
      '2026-09-15': ['daily_sign', 'other'],
    };
    const out = removeEntrySince(days, 'daily_sign', periodStart);
    expect(out['2026-09-13']).toEqual(['daily_sign']);
    expect(out['2026-09-15']).toEqual(['other']);
  });

  it('当天记录被清空后不留空数组键', () => {
    expect(removeEntrySince({ '2026-09-15': ['a'] }, 'a', periodStart)).toEqual({});
  });

  it('该条目在窗口内没有记录 / 起点晚于全部记录 → 不改引用', () => {
    const days = { '2026-09-15': ['a'] };
    expect(removeEntrySince(days, 'b', periodStart)).toBe(days);
    /* 起点在 9/16，9/15 的记录属于上一个周期，保留 */
    expect(removeEntrySince(days, 'a', at(2026, 9, 16))).toBe(days);
  });

  it('批量：一次处理多条', () => {
    const days = { '2026-09-15': ['a', 'b', 'c'] };
    expect(removeEntriesSince(days, ['a', 'c'], periodStart)).toEqual({ '2026-09-15': ['b'] });
  });
});

describe('pruneDays：只留最近 N 天', () => {
  const now = new Date(2026, 8, 15, 12);

  it('早于保留窗口的日期被丢掉', () => {
    const days = { '2026-05-01': ['old'], '2026-09-15': ['today'] };
    expect(pruneDays(days, now, 90)).toEqual({ '2026-09-15': ['today'] });
  });

  it('默认 90 天；窗口内不动引用', () => {
    const days = { '2026-09-15': ['today'] };
    expect(LOG_KEEP_DAYS).toBe(90);
    expect(pruneDays(days, now)).toBe(days);
  });
});

describe('eachDay / dayCount', () => {
  it('含两端、升序；跨月正确', () => {
    expect(eachDay('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
    expect(eachDay('2026-09-15', '2026-09-15')).toEqual(['2026-09-15']);
  });

  it('逆序 / 非法 → 空数组（不抛错）', () => {
    expect(eachDay('2026-09-16', '2026-09-15')).toEqual([]);
    expect(eachDay('乱填', '2026-09-15')).toEqual([]);
  });

  it('dayCount：无记录为 0', () => {
    expect(dayCount({ '2026-09-15': ['a', 'b'] }, '2026-09-15')).toBe(2);
    expect(dayCount({}, '2026-09-15')).toBe(0);
  });
});
