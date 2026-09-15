import { describe, expect, it } from 'vitest';
import { monthRangeLabel, todayDateLabel, weekRangeLabel } from './dateLabel';

/** 统一用本地时区的固定午间时刻构造，避免 UTC 偏移把日期翻到前一天 */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe('todayDateLabel：今日页顶部日期', () => {
  it('2026-09-11（周五）→ 9月11日 周五', () => {
    expect(todayDateLabel(at(2026, 9, 11))).toBe('9月11日 周五');
  });
});

describe('weekRangeLabel：本周页顶部区间（周一为起点）', () => {
  it('周中：2026-09-11（周五）→ 9月7日 - 9月13日', () => {
    expect(weekRangeLabel(at(2026, 9, 11))).toBe('9月7日 - 9月13日');
  });

  it('周一当天：2026-09-07 → 9月7日 - 9月13日', () => {
    expect(weekRangeLabel(at(2026, 9, 7))).toBe('9月7日 - 9月13日');
  });

  it('周日当天：2026-09-13 → 9月7日 - 9月13日', () => {
    expect(weekRangeLabel(at(2026, 9, 13))).toBe('9月7日 - 9月13日');
  });

  it('跨月：2026-09-29（周二）→ 9月28日 - 10月4日', () => {
    expect(weekRangeLabel(at(2026, 9, 29))).toBe('9月28日 - 10月4日');
  });

  it('跨年：2027-01-01（周五）→ 12月28日 - 1月3日', () => {
    expect(weekRangeLabel(at(2027, 1, 1))).toBe('12月28日 - 1月3日');
  });
});

describe('monthRangeLabel：本月页顶部区间（2026-09-15 新增）', () => {
  it('月中：2026-09-15 → 9月1日 - 9月30日', () => {
    expect(monthRangeLabel(at(2026, 9, 15))).toBe('9月1日 - 9月30日');
  });

  it('1 日与月末当天都落在同一区间', () => {
    expect(monthRangeLabel(at(2026, 9, 1))).toBe('9月1日 - 9月30日');
    expect(monthRangeLabel(at(2026, 9, 30))).toBe('9月1日 - 9月30日');
  });

  it('2 月按实际天数：平年 28 日 / 闰年 29 日', () => {
    expect(monthRangeLabel(at(2026, 2, 10))).toBe('2月1日 - 2月28日');
    expect(monthRangeLabel(at(2028, 2, 10))).toBe('2月1日 - 2月29日');
  });

  it('12 月只到 31 日，不跨年', () => {
    expect(monthRangeLabel(at(2026, 12, 20))).toBe('12月1日 - 12月31日');
  });
});
