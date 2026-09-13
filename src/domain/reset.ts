/**
 * 周期重置（设计文档 §7 / D2）—— 纯函数，无 IO。
 *
 * 核心：**靠时间戳比对，不靠定时器**。
 * 定时器在凌晨 5 点用户没开应用时根本不执行，跨时区还会错。
 *
 * 7 档周期不是同一种时间模型：
 *   - daily / weekly / monthly：时基周期，按 `meta.resetHour`（阴阳师为 05:00）推算
 *   - version / season：事件驱动周期，锚点取 `meta.periods[cycle].startAt`
 *   - once / limited：不自动重置，只靠 `until` 归档
 */
import type { Item, Meta } from '../api/types';

export interface ResetCtx {
  resetHour: number;
  periods: Meta['periods'];
}

const DAY_MS = 86400000;

/** 当天 `resetHour` 时刻（若此刻早于该时刻，则周期起点是昨天那一档） */
function lastHour(now: Date, resetHour: number): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), resetHour, 0, 0, 0);
  if (now.getTime() < d.getTime()) d.setDate(d.getDate() - 1);
  return d.getTime();
}

/** 本周一 `resetHour` 时刻（周一 05:00 为周常重置点） */
function lastMondayHour(now: Date, resetHour: number): number {
  const base = new Date(lastHour(now, resetHour));
  const dow = base.getDay(); // 0=周日
  const back = dow === 0 ? 6 : dow - 1;
  base.setDate(base.getDate() - back);
  return base.getTime();
}

/** 本月 1 日 `resetHour` 时刻 */
function firstDayHour(now: Date, resetHour: number): number {
  const d = new Date(now.getFullYear(), now.getMonth(), 1, resetHour, 0, 0, 0);
  if (now.getTime() < d.getTime()) d.setMonth(d.getMonth() - 1);
  return d.getTime();
}

/** 返回该条目「当前周期起点」的时间戳；`checked[id] < 起点` → 视为未完成 */
export function periodStartOf(it: Item, now: Date, ctx: ResetCtx): number {
  switch (it.cycle) {
    case 'daily':
      return lastHour(now, ctx.resetHour);
    case 'weekly':
      return lastMondayHour(now, ctx.resetHour);
    case 'monthly':
      return firstDayHour(now, ctx.resetHour);
    case 'version': {
      const anchor = ctx.periods.version;
      return anchor ? Date.parse(anchor.startAt) : 0;
    }
    case 'season': {
      const anchor = ctx.periods.season;
      return anchor ? Date.parse(anchor.startAt) : 0;
    }
    case 'once':
    case 'limited':
      return 0; // 一次性 / 限时：不自动重置，只靠 until 归档
    default:
      return 0;
  }
}

/**
 * 一次处理全量条目，返回归零后的状态；顺带清理已下线条目的过期键。
 * 复杂度 O(n)，n = 条目数（当前 89），启动时执行一次。
 */
export function mergeChecked(
  checked: Record<string, number>,
  items: Item[],
  now: Date,
  ctx: ResetCtx,
): Record<string, number> {
  const alive = new Set(items.map((i) => i.id));
  const out: Record<string, number> = {};
  for (const [id, at] of Object.entries(checked)) {
    if (!alive.has(id)) continue; // 条目已下线 / 已隐藏：顺手清理，避免无限膨胀
    const it = items.find((i) => i.id === id);
    if (!it) continue;
    if (at >= periodStartOf(it, now, ctx)) out[id] = at;
  }
  return out;
}

/** 条目是否已过 `until`（应从清单归档）。`until` = 从清单下线，≠ deadline（活动截止） */
export function isArchived(it: Item, now: Date): boolean {
  if (!it.until) return false;
  const [y, m, d] = it.until.split('-').map(Number);
  // 当天仍显示，次日归档
  const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime() + 1;
  return now.getTime() >= end;
}

/** 过滤已下线条目 */
export function activeItems(items: Item[], now: Date): Item[] {
  return items.filter((it) => !isArchived(it, now));
}

/** 距 `until` 还有几天（负数 = 已过） */
export function daysUntilExit(it: Item, now: Date): number | null {
  if (!it.until) return null;
  const [y, m, d] = it.until.split('-').map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  return Math.ceil((end - now.getTime()) / DAY_MS);
}
