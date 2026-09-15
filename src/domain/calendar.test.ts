import { describe, expect, it } from 'vitest';
import { buildMonthGrid, monthTitle, WEEKDAY_HEAD } from './calendar';

describe('buildMonthGrid：月历排版', () => {
  it('固定 6 行 × 7 列（行数恒定，切月不跳高度）', () => {
    const g = buildMonthGrid(new Date(2026, 8, 15, 12));
    expect(g.monthKey).toBe('2026-09');
    expect(g.weeks).toHaveLength(6);
    for (const week of g.weeks) expect(week).toHaveLength(7);
  });

  it('每行首列都是周一（与表头首项一致）', () => {
    expect(WEEKDAY_HEAD[0]).toBe('一');
    for (const week of buildMonthGrid(new Date(2026, 8, 15)).weeks) {
      expect(new Date(`${week[0].key}T00:00:00`).getDay()).toBe(1);
    }
  });

  it('2026-09 首格是 8月31日（周一，补位格），9月1日在第二格', () => {
    const g = buildMonthGrid(new Date(2026, 8, 15));
    expect(g.weeks[0][0]).toMatchObject({ key: '2026-08-31', day: 31, inMonth: false });
    expect(g.weeks[0][1]).toMatchObject({ key: '2026-09-01', day: 1, inMonth: true });
  });

  it('月内的日子标 inMonth，前后补位不标', () => {
    const inMonth = buildMonthGrid(new Date(2026, 8, 15)).weeks.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(30);
    expect(inMonth[0].day).toBe(1);
    expect(inMonth[inMonth.length - 1].day).toBe(30);
  });

  it('闰年 2 月按 29 天（月末由 Date 处理，不查天数表）', () => {
    const feb = buildMonthGrid(new Date(2028, 1, 10));
    expect(feb.monthKey).toBe('2028-02');
    expect(feb.weeks.flat().filter((c) => c.inMonth)).toHaveLength(29);
  });

  it('月初正好是周一时没有前置补位格', () => {
    /* 2026-06-01 是周一 */
    const g = buildMonthGrid(new Date(2026, 5, 10));
    expect(g.weeks[0][0]).toMatchObject({ key: '2026-06-01', inMonth: true });
  });

  it('monthTitle：2026 年 9 月', () => {
    expect(monthTitle(new Date(2026, 8, 15))).toBe('2026 年 9 月');
  });
});
