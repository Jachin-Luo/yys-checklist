/**
 * 倒计时与时间窗判定 —— 纯函数（设计文档 §4.2 时间字段三条规则 / §6.6 提醒取数）。
 * 只做**提示**，不限制勾选。
 */
import type { Item } from '../api/types';

const DAY_MS = 86400000;

/**
 * 时间串 → 时间戳（本地时区）。
 *   'YYYY-MM-DD'        视为当天 23:59:59
 *   'YYYY-MM-DD HH:mm'  按字面解析
 *   'YYYY-MM-DDTHH:mm'  同上（`meta.periods.startAt` 用此格式）
 */
export function parseTs(s?: string): number | null {
  if (!s) return null;
  const raw = String(s).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  if (h === undefined) return new Date(+y, +mo - 1, +d, 23, 59, 59, 0).getTime();
  return new Date(+y, +mo - 1, +d, +h, +mi, 0, 0).getTime();
}

/** 距截止还有几天（向上取整）。null = 无截止日 */
export function daysLeft(deadline?: string, now: Date = new Date()): number | null {
  const t = parseTs(deadline);
  if (t === null) return null;
  return Math.ceil((t - now.getTime()) / DAY_MS);
}

export type DeadlineLevel = 'hot' | 'warn' | 'normal' | 'none';

export interface DeadlineBadge {
  level: DeadlineLevel;
  /** 「剩 3 天 · 10/6 23:59 止」 */
  text: string;
  days: number | null;
}

/** 截止徽章：≤3 天转红、≤7 天转橙（设计文档 §6 / 原型 ddlHTML） */
export function deadlineBadge(it: Item, now: Date = new Date()): DeadlineBadge {
  if (!it.deadline) {
    const startTs = parseTs(it.start);
    if (it.start && startTs !== null && startTs > now.getTime()) {
      const [, mo, d] = it.start.split(' ')[0].split('-');
      return { level: 'none', text: `${+mo}/${+d} 开启`, days: null };
    }
    return { level: 'none', text: it.start ? '截止未定' : '待定', days: null };
  }
  const days = daysLeft(it.deadline, now) ?? 0;
  const [datePart, timePart] = it.deadline.split(' ');
  const [, mo, d] = datePart.split('-');
  const md = `${+mo}/${+d}${timePart ? ` ${timePart}` : ''}`;
  if (days <= 0) return { level: 'hot', text: `已结束 ${md}`, days };
  return {
    level: days <= 3 ? 'hot' : days <= 7 ? 'warn' : 'normal',
    text: `剩 ${days} 天 · ${md} 止`,
    days,
  };
}

export type TimeWindowState = 'none' | 'wait' | 'open' | 'over';

export interface TimeWindow {
  state: TimeWindowState;
  /** 「19:30-21:00 进行中」 */
  text: string;
}

const hm2min = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

/** 时间窗状态：未开始 / 进行中 / 已结束。没到点也**允许勾选** */
export function timeWindow(it: Item, now: Date = new Date()): TimeWindow {
  if (!it.time) return { state: 'none', text: it.timeNote || '' };
  const cur = now.getHours() * 60 + now.getMinutes();
  const from = hm2min(it.time);
  const to = it.timeEnd ? hm2min(it.timeEnd) : null;
  const range = to !== null ? `${it.time}-${it.timeEnd}` : it.time;
  if (to !== null && cur > to) return { state: 'over', text: `${range} 已结束` };
  if (cur >= from) return { state: 'open', text: `${range} 进行中` };
  return { state: 'wait', text: `${it.time} 未开始` };
}

/** 今天是否适用该条目（`days` 缺省 = 每天） */
export function appliesToday(it: Item, now: Date = new Date()): boolean {
  if (!it.days || !it.days.length) return true;
  return it.days.includes(now.getDay());
}
