/**
 * 痛感分（`weightOf`）—— 纯函数，可单测（设计文档 §4.2）。
 *
 * 取代原主观价值档 S/A/B/C：原 value 只是把「周期 + 稀缺性」两个客观维度凭感觉拍成了一个字母。
 * 需求原句「漏一次月度黑蛋 ≫ 漏一次每日金币」的真实依据就是这两个客观维度。
 *
 * 三个维度：
 *   周期    once/limited/version/season 40 > monthly 30 > weekly 20 > daily 10
 *   稀缺性  有 deadline 或 until → +15
 *   固定收益 有 gain → +10
 *
 * ⚠️ `isAutoHub`（一键日常入口）**不参与本函数比较** —— 它的产品语义是「不参与排序」，
 * 由 `domain/sort.ts` 的前置特判处理（D1）。实测它 cycle=daily、无 gain → 仅 10 分，
 * 若不特判会沉到日常组末尾，与「恒置顶」完全相反。
 */
import type { Item } from '../api/types';
import type { Cycle } from './enums';

const CYCLE_WEIGHT: Record<Cycle, number> = {
  once: 40,
  limited: 40,
  version: 40,
  season: 40,
  monthly: 30,
  weekly: 20,
  daily: 10,
};

export function weightOf(it: Item): number {
  const cycleW = CYCLE_WEIGHT[it.cycle] ?? 10;
  const scarce = it.deadline || it.until ? 15 : 0;
  const hasGain = it.gain ? 10 : 0;
  return cycleW + scarce + hasGain;
}

/** 周期排序权重（同分兜底用；越小越靠前） */
export function cycleRank(it: Item): number {
  const order: Cycle[] = ['once', 'limited', 'version', 'season', 'monthly', 'weekly', 'daily'];
  const idx = order.indexOf(it.cycle);
  return idx < 0 ? order.length : idx;
}

/* 2026-09-15：原先的 `WEIGHT_LEGEND`（UI 图例数据）已删除 ——
   全库没有消费方，且痛感已收敛为"只作默认排序键"，不再需要向用户解释分数构成。
   公式本身仍写在 README「核心思路」与 `meta.weightNote` 里（数据层文案，不动）。 */
