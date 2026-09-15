/**
 * 统计与漏失 —— 纯函数，可单测（设计文档 §7 统计定位「最强留存钩子」/ Q6 / Q23）。
 *
 * 三条口径纪律：
 *   1. **只统计固定数值**（`gain`）。浮动收益（只有 `gainKind`）不进分子分母 ——
 *      不能把"看打掉几个"当保底算（需求 F21）。
 *   2. **被覆盖项照样计入**：`coverMode`（dim/hide）只决定列表怎么渲染，
 *      绝不参与本文件的计算，否则"隐藏 = 少算收益"，那是数据错误。
 *   3. **忽略「隐藏已完成」**：本文件直接吃原始 `checked`，
 *      不存在"已勾条目被过滤 → 已获得归零"的可能（原型为此专门传 `keepDone=true`）。
 *
 * 2026-09-15：原先末尾那条「漏失明细只列事实、不折算、不估算」（Q6）随 `missGroups` 一并删除 ——
 * 详见文件下半部分的说明。
 */
import type { Gain, Item } from '../api/types';
import { eachDay, type LogDays } from './checkLog';
import type { Cycle } from './enums';

export type StatPeriod = 'day' | 'week' | 'month';

/** 各统计口径覆盖的周期：本日 = 日常；本周 = 周常；本月·版本 = 每月 / 版本 / 赛季 */
const PERIOD_CYCLES: Record<StatPeriod, Cycle[]> = {
  day: ['daily'],
  week: ['weekly'],
  month: ['monthly', 'version', 'season'],
};

export interface GainSummary {
  got: number;
  total: number;
  left: number;
  /** 完成百分比（0–100，整数） */
  pct: number;
}

export interface GainRow {
  id: string;
  name: string;
  checked: boolean;
  gain: Gain;
}

export interface GainReport {
  jade: GainSummary;
  blackFrag: GainSummary;
  blueTicket: GainSummary;
  /** 参与统计的条目（已含自建条目），供明细行渲染 */
  rows: GainRow[];
}

/** 黑碎存在 0.5 这类小数，统一保留 1 位，避免 0.1+0.2 的浮点噪声 */
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** 该统计口径下的条目（不限是否有固定收益） */
export function periodItems(items: Item[], period: StatPeriod): Item[] {
  const cycles = PERIOD_CYCLES[period];
  return items.filter((it) => cycles.includes(it.cycle));
}

/** 固定收益汇总：三币种的「已得 / 总量 / 还差 / 完成度」+ 明细行 */
export function summarizeGain(
  items: Item[],
  checked: Record<string, number>,
  period: StatPeriod,
): GainReport {
  const rows: GainRow[] = periodItems(items, period)
    .filter((it) => it.gain)
    .map((it) => ({
      id: it.id,
      name: it.name,
      checked: checked[it.id] !== undefined,
      gain: it.gain as Gain,
    }));

  const summaryOf = (key: keyof Gain): GainSummary => {
    const total = round1(rows.reduce((s, r) => s + (r.gain[key] || 0), 0));
    const got = round1(rows.reduce((s, r) => s + (r.checked ? r.gain[key] || 0 : 0), 0));
    return {
      got,
      total,
      left: round1(Math.max(total - got, 0)),
      pct: total > 0 ? Math.round((got / total) * 100) : 0,
    };
  };

  return {
    jade: summaryOf('jade'),
    blackFrag: summaryOf('blackFrag'),
    blueTicket: summaryOf('blueTicket'),
    rows,
  };
}

/* 2026-09-15：原先的「漏失明细」整块（`MissLevel` / `MissItem` / `MissGroup` / `LEVEL_LABEL` / `missGroups`）
   已删除 —— 它按痛感分给漏掉的条目分级（高 / 中 / 低），是痛感在排序之外的第二个用途，
   随「痛感只用于默认排序」的收敛一并移除；统计页自 2026-09-14 起也不再展示这一块。 */

/** 统计口径文案（页面副标题用，避免页面里散落魔法字符串） */
export const PERIOD_META: Record<StatPeriod, { label: string; note: string }> = {
  day: { label: '本日', note: '每日 0 点刷新' },
  week: { label: '本周', note: '周一 0 点刷新' },
  month: { label: '本月 · 版本', note: '版本 / 赛季按上线锚点重置，活动结束清零' },
};

/* ───────────────────────── 按日期区间的收益（2026-09-15） ───────────────────────── */

export interface RangeDayGain {
  /** 当天勾选的条数（含无固定收益的 —— 日历着色看的是"做了多少事"） */
  entries: number;
  jade: number;
  blackFrag: number;
  blueTicket: number;
}

export interface RangeGain {
  jade: number;
  blackFrag: number;
  blueTicket: number;
  /** 区间内的完成记录总数（同一条目在多天各勾一次就计多次） */
  entries: number;
  /** 每天明细：日历着色与单日卡片共用同一份数据，日历不必再算一遍 */
  byDay: Record<string, RangeDayGain>;
}

/**
 * 按**日期区间**汇总固定收益（统计页的「近 7 天 / 近 30 天 / 某一天」）。
 *
 * 与 `summarizeGain` 的区别：那个按**周期**（本日 / 本周 / 本月）算"当前周期的完成进度"
 * （分子分母都限定在周期内，有"总量 / 还差"）；这个算"这段时间里实际拿到了多少" ——
 * 同一条目多天各勾一次就计多次（每日签到 7 天就是 7 份），因此没有总量与百分比。
 *
 * 数据源是**勾选日志**（`CheckLog.days`）：`checked` 只留最近一次，回答不了区间问题。
 * 口径纪律不变：只统计 `gain` 里的固定数值，浮动收益不折算。
 */
export function summarizeRangeGain(
  items: Item[],
  days: LogDays,
  fromKey: string,
  toKey: string,
): RangeGain {
  const byId = new Map(items.map((it) => [it.id, it]));
  const byDay: Record<string, RangeDayGain> = {};
  let entries = 0;
  let jade = 0;
  let blackFrag = 0;
  let blueTicket = 0;

  for (const key of eachDay(fromKey, toKey)) {
    const day: RangeDayGain = { entries: 0, jade: 0, blackFrag: 0, blueTicket: 0 };
    for (const id of days[key] ?? []) {
      day.entries += 1;
      /* 条目可能已被删除、或已是历史 id（活动条目下线）—— 计入条数但不计收益，
         不报错也不过滤整条记录：那天确实勾过，日历该有痕迹（运行期脏数据，见 AGENTS 红线） */
      const gain = byId.get(id)?.gain;
      if (!gain) continue;
      day.jade += gain.jade ?? 0;
      day.blackFrag += gain.blackFrag ?? 0;
      day.blueTicket += gain.blueTicket ?? 0;
    }
    day.jade = round1(day.jade);
    day.blackFrag = round1(day.blackFrag);
    day.blueTicket = round1(day.blueTicket);
    byDay[key] = day;
    entries += day.entries;
    jade += day.jade;
    blackFrag += day.blackFrag;
    blueTicket += day.blueTicket;
  }

  return {
    jade: round1(jade),
    blackFrag: round1(blackFrag),
    blueTicket: round1(blueTicket),
    entries,
    byDay,
  };
}
