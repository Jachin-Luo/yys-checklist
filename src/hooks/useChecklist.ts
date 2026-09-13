import { useMemo } from 'react';
import type { Item } from '../api/types';
import { hiddenByCover } from '../domain/autoDaily';
import { applyGuildTimeAll } from '../domain/guildTime';
import { buildComparator, effectiveSortBy, isVisible } from '../domain/sort';
import { weightOf } from '../domain/weight';
import { useCheckStore } from '../stores/check';
import { useItemStore } from '../stores/items';
import { useViewStore } from '../stores/view';
import { useAutoDaily } from './useAutoDaily';
import { useDevicePrefs } from './useDevicePrefs';

/**
 * 清单数据编排（状态层）：把「过滤 + 排序 + 分组」组合出来给两端布局用。
 * 规则本身都在 `domain/`（sort / weight / countdown / autoDaily / guildTime），本文件只做编排。
 *
 * 两处产品决策落在这里：
 *   - 排序不再让用户选 —— 默认痛感分，有自定义顺序则直接接管（`effectiveSortBy`）
 *   - 寮自定时间由用户配置叠加（`applyGuildTimeAll`），不改主数据
 */
export type ChecklistTarget = 'today' | 'week';

export interface Checklist {
  hub: Item | null;
  /** 入口是否已完成（已完成时由页面放进「已完成」分区，不再常驻顶部） */
  hubDone: boolean;
  pending: Item[];
  done: Item[];
  /** 已完成计数（含入口） */
  doneCount: number;
  /** 本周高痛感未完成数（今日页警示条用） */
  weeklyHighWeightLeft: number;
  total: number;
  /** 被一键日常覆盖的条目集合（供两端决定是否弱化渲染） */
  coveredSet: Set<string>;
  /** 被覆盖项的显示方式：dim 弱化 / hide 不出现 */
  coverMode: 'dim' | 'hide';
}

/** 高痛感阈值：weekly 基线 20，带固定收益或截止日即 ≥30 */
export const HIGH_WEIGHT = 30;

export function useChecklist(target: ChecklistTarget): Checklist {
  const items = useItemStore((s) => s.items);
  const overrides = useItemStore((s) => s.overrides);
  const checked = useCheckStore((s) => s.checked);
  const view = useViewStore((s) => s.view);
  const { coveredSet, coverMode } = useAutoDaily();
  const { guildTime } = useDevicePrefs();

  const order = overrides?.order;
  const orderKey = (order ?? []).join(',');

  return useMemo(() => {
    const now = new Date();
    /* 寮自定时间在展示层叠加：只改 time，不动主数据 */
    const displayItems = applyGuildTimeAll(items, guildTime);

    const orderList = orderKey ? orderKey.split(',') : [];
    const comparator = buildComparator({
      sortBy: effectiveSortBy(orderList),
      pinned: view.pinned,
      order: orderList,
    });
    const visibility = {
      showKinds: view.showKinds as string[],
      minWeight: view.minWeight,
      hideDone: view.hideDone,
      today: now.getDay(),
    };

    const inScope = displayItems.filter((it) => {
      if (target === 'today') return it.cycle === 'daily';
      /* version / season 不在周页（2026-09-11 用户决策）：这两类随版本/赛季滚动、无固定截止，
         挪到限时页的「版本 / 赛季」分区（见 LimitedPage）。
         统计口径不受影响 —— domain/stats 的 month 仍覆盖这两个周期 */
      return it.cycle === 'weekly' || it.cycle === 'monthly';
    });

    /* coverMode 只影响**列表渲染**：`hide` 时不渲染被覆盖项；
       它绝不进入统计与漏失口径（那是 domain/stats 的事，被覆盖项照样计入）。
       入口自身永不被隐藏，否则整块入口会连着自己一起消失。 */
    const listed = inScope.filter((it) => !hiddenByCover(it, coveredSet, coverMode));

    const sorted = listed
      .filter((it) => isVisible(it, checked[it.id], visibility))
      .sort(comparator);

    const hub = sorted.find((it) => it.isAutoHub) ?? null;
    const rest = sorted.filter((it) => !it.isAutoHub);
    const hubDone = hub ? checked[hub.id] !== undefined : false;
    const doneItems = rest.filter((it) => checked[it.id] !== undefined);

    return {
      hub,
      hubDone,
      pending: rest.filter((it) => checked[it.id] === undefined),
      done: doneItems,
      doneCount: doneItems.length + (hubDone ? 1 : 0),
      weeklyHighWeightLeft: displayItems.filter(
        (it) => it.cycle === 'weekly' && weightOf(it) >= HIGH_WEIGHT && checked[it.id] === undefined,
      ).length,
      total: rest.length,
      coveredSet,
      coverMode,
    };
  }, [items, checked, view, orderKey, target, coveredSet, coverMode, guildTime]);
}
