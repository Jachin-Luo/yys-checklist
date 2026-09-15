/**
 * 勾选日志（2026-09-15）—— 纯函数，无 IO。
 *
 * 职责：按**日期**分桶记下「那天勾了什么」，供统计页的日历与「近 N 天收益」使用。
 * `CheckState.checked` 每条只保留最近一次勾选时间戳（周期重置靠它比对），
 * "前天做过什么"这类历史问题只能由本文件回答。
 *
 * 两条口径：
 *   1. 日志是**历史事实** —— 周期重置**不清**它（那天确实完成过）；
 *   2. 只有**取消勾选**才回退，且按该条目的**周期起点**回退（`removeEntrySince`）：
 *      "本周期未完成"不等于"历史上从没完成过"，上个月真做过的那次不该被今天抹掉。
 */
import type { CheckLog } from '../api/types';

export type LogDays = CheckLog['days'];

/** 日志保留天数：覆盖「当前月 + 前两个月」，够日历与近 30 天区间用 */
export const LOG_KEEP_DAYS = 90;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** 时间戳 → 本地时区 `YYYY-MM-DD`（按用户本地日划分，与「每日 0 点刷新」同一时区口径） */
export function dayKeyOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** `Date` → `YYYY-MM-DD` */
export const dayKey = (d: Date): string => dayKeyOf(d.getTime());

/** `YYYY-MM-DD` → 当天 0 点的时间戳；非法返回 null */
export function keyToTs(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(+y, +mo - 1, +d).getTime();
}

/** 日期键 ± n 天（跨月 / 跨年交给 `Date` 处理） */
export function shiftDayKey(key: string, delta: number): string {
  const ts = keyToTs(key);
  if (ts === null) return key;
  const d = new Date(ts);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

/** 某天勾选的条数（日历着色与悬停提示用） */
export const dayCount = (days: LogDays, key: string): number => days[key]?.length ?? 0;

/** 记一条完成。幂等：同一天重复勾同一条不重复记 */
export function addEntry(days: LogDays, itemId: string, ts: number): LogDays {
  const key = dayKeyOf(ts);
  const list = days[key] ?? [];
  if (list.includes(itemId)) return days;
  return { ...days, [key]: [...list, itemId] };
}

/**
 * 取消勾选：移除该条目**自 `fromTs`（该条目的周期起点）以来**的记录。
 * 只回退本周期 —— 上个月确实做过的那次保留。
 */
export function removeEntrySince(days: LogDays, itemId: string, fromTs: number): LogDays {
  const fromKey = dayKeyOf(fromTs);
  let changed = false;
  const out: LogDays = {};
  for (const [key, list] of Object.entries(days)) {
    /* `YYYY-MM-DD` 是定长格式，字符串比较即日期比较 */
    if (key >= fromKey && list.includes(itemId)) {
      const next = list.filter((id) => id !== itemId);
      changed = true;
      if (next.length) out[key] = next;
      continue;
    }
    out[key] = list;
  }
  return changed ? out : days;
}

/** 批量取消（`clearChecked` / 级联取消用）：一次遍历处理多条，避免反复重建对象 */
export const removeEntriesSince = (days: LogDays, itemIds: string[], fromTs: number): LogDays =>
  itemIds.reduce((acc, id) => removeEntrySince(acc, id, fromTs), days);

/** 修剪：只保留最近 `keepDays` 天。写入时顺手调用，避免分片无限增长 */
export function pruneDays(days: LogDays, now: Date, keepDays: number = LOG_KEEP_DAYS): LogDays {
  const from = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - keepDays));
  let changed = false;
  const out: LogDays = {};
  for (const [key, list] of Object.entries(days)) {
    if (key < from) {
      changed = true;
      continue;
    }
    out[key] = list;
  }
  return changed ? out : days;
}

/** 区间内的每一天（含两端、升序）。`fromKey > toKey` 或格式非法时返回空数组 */
export function eachDay(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  if (keyToTs(fromKey) === null || keyToTs(toKey) === null || fromKey > toKey) return out;
  let cur = fromKey;
  /* 上限兜底：正常区间最多几百天，防手改过的数据把这里变成死循环 */
  for (let i = 0; i < 400 && cur <= toKey; i++) {
    out.push(cur);
    cur = shiftDayKey(cur, 1);
  }
  return out;
}
