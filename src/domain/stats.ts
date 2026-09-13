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
 * 漏失明细**只列事实、不折算、不估算**（Q6）：列出漏掉的条目名与奖励，让用户自己判断痛不痛。
 */
import type { Gain, Item } from '../api/types';
import type { Cycle } from './enums';
import { weightOf } from './weight';

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

export type MissLevel = 'high' | 'mid' | 'low';

export interface MissItem {
  id: string;
  name: string;
  weight: number;
}

export interface MissGroup {
  level: MissLevel;
  label: string;
  items: MissItem[];
}

const LEVEL_LABEL: Record<MissLevel, string> = {
  high: '高痛感',
  mid: '中痛感',
  low: '低痛感',
};

/**
 * 按痛感分级列出漏掉的条目（只列事实，不折算）。
 * 分级口径直接复用 `weightOf`：≥40 高（一次性/限时/版本/赛季）、20–39 中（周常/月常/带收益的日常）、<20 低。
 */
export function missGroups(
  items: Item[],
  checked: Record<string, number>,
  period: StatPeriod,
): MissGroup[] {
  const buckets: Record<MissLevel, MissItem[]> = { high: [], mid: [], low: [] };

  for (const it of periodItems(items, period)) {
    if (it.isAutoHub) continue; // 入口已由被覆盖项代表，不计入漏失
    if (checked[it.id] !== undefined) continue;
    const weight = weightOf(it);
    const level: MissLevel = weight >= 40 ? 'high' : weight >= 20 ? 'mid' : 'low';
    buckets[level].push({ id: it.id, name: it.name, weight });
  }

  return (['high', 'mid', 'low'] as MissLevel[])
    .map((level) => ({
      level,
      label: LEVEL_LABEL[level],
      items: buckets[level].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'zh')),
    }))
    .filter((g) => g.items.length > 0);
}

/** 统计口径文案（页面副标题用，避免页面里散落魔法字符串） */
export const PERIOD_META: Record<StatPeriod, { label: string; note: string }> = {
  day: { label: '本日', note: '每日 05:00 重置' },
  week: { label: '本周', note: '周一 05:00 重置' },
  month: { label: '本月 · 版本', note: '版本 / 赛季按开服锚点重置，活动结束清零' },
};
