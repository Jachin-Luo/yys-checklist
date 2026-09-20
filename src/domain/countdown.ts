/**
 * 倒计时与时间窗判定 —— 纯函数（设计文档 §4.2 时间字段三条规则 / §6.6 提醒取数）。
 * 只做**提示**，不限制勾选。
 */
import type { Item } from '../api/types';

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

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

/**
 * 距截止还有几小时（向上取整）。null = 无截止日。
 *
 * 2026-09-20 新增（用户要求：不足一天显示小时）。它与 `daysLeft` 是**同一次时间差的两种刻度**，
 * 不是替代关系：`daysLeft` 的 ceil 会把"还有 2 小时"说成"剩 1 天" —— 对限时活动的最后一段
 * 来说太粗，"剩 1 天"让人以为还有一整天，而实际马上要结束。徽章在剩余不足 24 小时时改用它。
 *
 * `daysLeft` 保持原样：排序（`deadlineRank` 走的是原始时间戳）、`LimitedPage` 的 urgent 计数
 * （`d <= 3`）依赖的是它"按天粗粒度"的语义，把它们改成小时口径属于另一件事。
 */
export function hoursLeft(deadline?: string, now: Date = new Date()): number | null {
  const t = parseTs(deadline);
  if (t === null) return null;
  return Math.ceil((t - now.getTime()) / HOUR_MS);
}

export type DeadlineLevel = 'hot' | 'warn' | 'normal' | 'none';

export interface DeadlineBadge {
  level: DeadlineLevel;
  /** 「剩 3 天 · 10/6 23:59 止」；不足一天时是「剩 5 小时 · 10/6 23:59 止」 */
  text: string;
  /** 剩余天数（向上取整，**粗粒度**口径）。无截止日 = null */
  days: number | null;
  /**
   * 剩余小时数（向上取整）—— 仅当"不足一天且尚未结束"时有值，其余为 null。
   * 与 `days` 并存而不是取代它：颜色分级（≤3 天红）仍走 `days`，两者各司其职。
   */
  hours: number | null;
}

/** 截止徽章：≤3 天转红、≤7 天转橙（设计文档 §6 / 原型 ddlHTML） */
export function deadlineBadge(it: Item, now: Date = new Date()): DeadlineBadge {
  if (!it.deadline) {
    const startTs = parseTs(it.start);
    if (it.start && startTs !== null && startTs > now.getTime()) {
      const [, mo, d] = it.start.split(' ')[0].split('-');
      return { level: 'none', text: `${+mo}/${+d} 开启`, days: null, hours: null };
    }
    return { level: 'none', text: it.start ? '截止未定' : '待定', days: null, hours: null };
  }
  const ts = parseTs(it.deadline);
  const remain = ts === null ? 0 : ts - now.getTime();
  const days = daysLeft(it.deadline, now) ?? 0;
  /* 不足一天 → 改按小时显示（2026-09-20 用户要求）。
     上界取 `< DAY_MS`：正好剩 24 小时仍归"天"，与 ceil 的结果一致，不必特判。
     下界取 `> 0`：恰好 0 或已过都归"已结束"，不会出现「剩 0 小时」。
     `ceil` 已保证最小为 1，所以"还剩 30 分钟"显示「剩 1 小时」而不是 0。 */
  const hours = remain > 0 && remain < DAY_MS ? Math.ceil(remain / HOUR_MS) : null;
  const [datePart, timePart] = it.deadline.split(' ');
  const [, mo, d] = datePart.split('-');
  const md = `${+mo}/${+d}${timePart ? ` ${timePart}` : ''}`;
  /* 判据用 `remain` 而不是 `days <= 0`：两者等价（负数的 ceil 仍 ≤ 0），但这里要表达的
     本来就是"时间到了没有"，直接比时间差少一层换算 */
  if (remain <= 0) return { level: 'hot', text: `已结束 ${md}`, days, hours: null };
  return {
    level: days <= 3 ? 'hot' : days <= 7 ? 'warn' : 'normal',
    text: hours !== null ? `剩 ${hours} 小时 · ${md} 止` : `剩 ${days} 天 · ${md} 止`,
    days,
    hours,
  };
}

/**
 * 把"还剩多久"的毫秒差格式化成**天 + 小时**（2026-09-20 用户要求：今日 / 本周 / 本月都加倒计时，
 * 精确到天和小时）。
 *
 * 用 `floor` 而不是 `ceil`：这里的用途是"还剩多少可支配时间"，说多了会让用户以为还来得及。
 * 这和 `deadlineBadge` 的 `ceil` 是**刻意不同**的口径 —— 那边要避免"剩 0 天"这种表达，
 * 且它回答的是"哪天截止"。两处别互相对齐。
 *
 * 边界：不足 1 小时说"不足 1 小时"而不是"剩 0 小时"（后者读起来像已经结束）；
 * 小时为 0 时省掉那一段（"剩 2 天"而不是"剩 2 天 0 小时"）。
 */
export function formatRemain(ms: number): string {
  if (ms <= 0) return '即将刷新';
  const hours = Math.floor(ms / HOUR_MS);
  if (hours < 1) return '不足 1 小时';
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (days === 0) return `剩 ${rest} 小时`;
  if (rest === 0) return `剩 ${days} 天`;
  return `剩 ${days} 天 ${rest} 小时`;
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
