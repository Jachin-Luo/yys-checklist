import { useMemo } from 'react';
import type { Item } from '../api/types';
import { hiddenByCover } from '../domain/autoDaily';
import { applyGuildTimeAll } from '../domain/guildTime';
import { isCardDone } from '../domain/steps';
import { buildComparator, effectiveSortBy, isVisible } from '../domain/sort';
import { useCheckStore } from '../stores/check';
import { useGuildTimeStore } from '../stores/guildTime';
import { useItemStore } from '../stores/items';
import { useViewStore } from '../stores/view';
import { useAutoDaily } from './useAutoDaily';

/**
 * 清单数据编排（状态层）：把「过滤 + 排序 + 分组」组合出来给两端布局用。
 * 规则本身都在 `domain/`（sort / countdown / autoDaily / guildTime），本文件只做编排。
 *
 * 两处产品决策落在这里：
 *   - 排序不再让用户选 —— 默认痛感分，有自定义顺序则直接接管（`effectiveSortBy`）
 *   - 寮自定时间由用户配置叠加（`applyGuildTimeAll`），不改主数据
 *
 * 2026-09-15「痛感只用于默认排序」的收敛落到这里：不再计算 `weeklyHighWeightLeft`
 * （今日页那条"本周高痛感还剩 N 项"警示条已删除），过滤也不再传 `minWeight`
 * （门槛判断已从 `domain/sort.isVisible` 移除）。
 */
export type ChecklistTarget = 'today' | 'week' | 'month';

export interface Checklist {
  hub: Item | null;
  /** 入口是否已完成（已完成时由页面放进「已完成」分区，不再常驻顶部） */
  hubDone: boolean;
  pending: Item[];
  done: Item[];
  /** 已完成计数（含入口） */
  doneCount: number;
  total: number;
  /** 被一键日常覆盖的条目集合（供两端决定是否弱化渲染） */
  coveredSet: Set<string>;
  /** 被覆盖项的显示方式：dim 弱化 / hide 不出现 */
  coverMode: 'dim' | 'hide';
}

export function useChecklist(target: ChecklistTarget): Checklist {
  const items = useItemStore((s) => s.items);
  const overrides = useItemStore((s) => s.overrides);
  const checked = useCheckStore((s) => s.checked);
  const view = useViewStore((s) => s.view);
  const { coveredSet, coverMode } = useAutoDaily();
  /* 寮时间 2026-09-16 由设备级升为账号级：换号会跟着换，所以清单页的寮自定时间也随之变 */
  const guildTime = useGuildTimeStore((s) => s.guildTime);

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
      /* 库内序号：默认排序就按它（2026-09-30 起不再是痛感分）。
         在此现算而不是从外面传 —— 它就是 `items` 的数组下标，多一层传递只会漂移 */
      dbIndex: new Map(items.map((it, i) => [it.id, i] as const)),
    });
    const visibility = { today: now.getDay() };

    const inScope = displayItems.filter((it) => {
      if (target === 'today') return it.cycle === 'daily';
      /* 月常自成一页（2026-09-15 用户需求）：此前与周常同在本周页，但两者刷新口径不同 ——
         周常周一 0 点、月常每月 1 日 0 点，混在一起时"哪几条下周才会翻篇"看不出来 */
      if (target === 'month') return it.cycle === 'monthly';
      /* 周页只留周常：一个周期一页，别的一律不在这儿出现
         （`limited` 全部在限时页 —— 含 2026-09-28 并入的版本 / 赛季活动） */
      return it.cycle === 'weekly';
    });

    /* 视图筛选只决定"这张卡自己显不显示"。子组（2026-09-28）不需要"成员豁免"那类补丁 ——
       子步骤压根不是独立条目，不会被筛掉，也不存在"组被拆散"。
       入口自身也永不被隐藏，否则整块入口会连着自己一起消失。
       coverMode 只影响**列表渲染**，绝不进入统计口径（被覆盖项照样计入收益）。 */
    const sorted = inScope
      .filter((it) => !hiddenByCover(it, coveredSet, coverMode) && isVisible(it, visibility))
      .sort(comparator);

    const hub = sorted.find((it) => it.isAutoHub) ?? null;
    const rest = sorted.filter((it) => !it.isAutoHub);
    const hubDone = hub ? checked[hub.id] !== undefined : false;
    const isDone = (id: string) => checked[id] !== undefined;
    /* 按"卡"切分：整张卡的所有步都做完才算完成；做了一半仍是一张**待做**的卡（卡上带进度），
       不会"半张卡在两段各出现一次"（见 domain/steps 的口径 ②） */
    const doneItems = rest.filter((it) => isCardDone(it, isDone));

    return {
      hub,
      hubDone,
      pending: rest.filter((it) => !isCardDone(it, isDone)),
      done: doneItems,
      doneCount: doneItems.length + (hubDone ? 1 : 0),
      total: rest.length,
      coveredSet,
      coverMode,
    };
  }, [items, checked, view, orderKey, target, coveredSet, coverMode, guildTime]);
}
