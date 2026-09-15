/**
 * 月历网格（2026-09-15 新增，统计页顶部日历）—— 纯函数，无 IO。
 *
 * 只负责**排版**：把一个自然月摊成周一起始的 6×7 网格（含前后补位格）。
 * 深浅着色、点击选中、区间统计分别在页面与 `domain/checkLog` / `domain/stats` 里完成。
 *
 * 周一起始与全站口径一致（`dateLabel.weekRangeLabel` 的自然周同样周一为起点）。
 * 固定 6 行：行数恒定，切月时容器高度不跳。
 */
import { dayKey, shiftDayKey } from './checkLog';

export interface CalendarCell {
  /** `YYYY-MM-DD` */
  key: string;
  /** 日号（1–31） */
  day: number;
  /** 是否属于当前月（前后补位格为 false，渲染时弱化） */
  inMonth: boolean;
}

export interface MonthGrid {
  /** `YYYY-MM`，用作渲染 key */
  monthKey: string;
  /** 7 格一行（周一起始），固定 6 行 */
  weeks: CalendarCell[][];
}

/** 日历表头（周一起始，与自然周口径一致） */
export const WEEKDAY_HEAD = ['一', '二', '三', '四', '五', '六', '日'] as const;

/** 「2026 年 9 月」——页面标题用，避免页面里再拼一次日期 */
export function monthTitle(now: Date): string {
  return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;
}

export function buildMonthGrid(now: Date): MonthGrid {
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthKey = dayKey(new Date(y, m, 1)).slice(0, 7);
  const first = new Date(y, m, 1);
  /* 周一起始：周日的 getDay() = 0，要回退 6 天而不是 0 天 */
  const lead = (first.getDay() + 6) % 7;
  let cur = shiftDayKey(dayKey(first), -lead);

  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const [yy, mm, dd] = cur.split('-').map(Number);
      week.push({ key: cur, day: dd, inMonth: yy === y && mm === m + 1 });
      cur = shiftDayKey(cur, 1);
    }
    weeks.push(week);
  }
  return { monthKey, weeks };
}
