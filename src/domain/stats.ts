/**
 * 统计与漏失 —— 纯函数，可单测（设计文档 §7 统计定位「最强留存钩子」/ Q6 / Q23）。
 *
 * 三条口径纪律：
 *   1. **只统计固定数值**（`gain`）。浮动收益（只有 `gainKind`）不进分子分母 ——
 *      不能把"看打掉几个"当保底算（需求 F21）。（2026-09-29 周期口径删除后，本文件在跑的
 *      实现只剩 `summarizeRangeGain`，纪律不变。）
 *   2. **被覆盖项照样计入**：`coverMode`（dim/hide）只决定列表怎么渲染，
 *      绝不参与本文件的计算，否则"隐藏 = 少算收益"，那是数据错误。
 *   3. **不受任何列表筛选影响**：本文件直接吃原始 `checked`，不经过 `domain/sort.isVisible`
 *      —— 已勾条目的收益必然计入「已获得」，不存在"被过滤 → 归零"的可能。
 *      （此前那条「隐藏已完成」筛选与它的豁免口 `keepDone` 已于 2026-09-24 整体删除：
 *      它没有 UI 却仍在过滤里生效，属"用户改不了、也看不出"的隐患。）
 *
 * 2026-09-15：原先末尾那条「漏失明细只列事实、不折算、不估算」（Q6）随 `missGroups` 一并删除 ——
 * 详见文件下半部分的说明。
 */
import type { Item } from '../api/types';
import { eachDay, type LogDays } from './checkLog';

/* 2026-09-29：**周期进度口径整块删除** —— `StatPeriod` / `PERIOD_CYCLES` / `periodItems` /
   `summarizeGain` 与 `GainSummary` / `GainReport`（原本排在这里）。自 2026-09-15 统计页改版
   起它就没有页面消费了（页面只剩"按日期区间"的收益这一条路径），全库只有它自己的单测在断言 ——
   与 2026-09-28 删掉的 `GainRow` / `GainReport.rows` 同一类（"没有消费者的数据不留"）。
   本文件现在只剩区间收益一条统计路径，纪律 ① 仍由它守住；纪律 ②③（被覆盖项照样计入 /
   不受列表筛选影响）原本是靠"周期口径直接吃原始 `checked`"钉住的，而区间收益的数据源是
   **勾选日志**、本就不经过任何筛选 —— 字面表述保留在文件头，但不再有专门用例（需要时从 git 取回）。 */

/** 黑碎存在 0.5 这类小数，统一保留 1 位，避免 0.1+0.2 的浮点噪声 */
const round1 = (n: number): number => Math.round(n * 10) / 10;

/* 2026-09-15：原先的「漏失明细」整块（`MissLevel` / `MissItem` / `MissGroup` / `LEVEL_LABEL` / `missGroups`）
   已删除 —— 它按痛感分给漏掉的条目分级（高 / 中 / 低），是痛感在排序之外的第二个用途，
   随「痛感只用于默认排序」的收敛一并移除；统计页自 2026-09-14 起也不再展示这一块。 */

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
 * 算的是"这段时间里实际拿到了多少" —— 同一条目多天各勾一次就计多次（每日签到 7 天就是 7 份），
 * 因此没有总量与百分比（"周期进度"口径已于 2026-09-29 删除，见文件上方说明）。
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
