import { useMemo } from 'react';
import type { Item } from '../api/types';
import { hiddenByCover } from '../domain/autoDaily';
import { applyGuildTimeAll } from '../domain/guildTime';
import { groupedMemberIds } from '../domain/grouping';
import { buildComparator, effectiveSortBy, isVisible } from '../domain/sort';
import { useCheckStore } from '../stores/check';
import { useGuildTimeStore } from '../stores/guildTime';
import { useItemStore } from '../stores/items';
import { SHOW_KIND_FILTER, useViewStore } from '../stores/view';
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
    });
    const visibility = {
      /* 筛选入口暂时下线：开关关着时一律传空数组，避免"看不见的筛选"把条目悄悄滤掉
         （见 `stores/view.SHOW_KIND_FILTER` 的说明） */
      showKinds: SHOW_KIND_FILTER ? (view.showKinds as string[]) : [],
      today: now.getDay(),
    };

    const inScope = displayItems.filter((it) => {
      if (target === 'today') return it.cycle === 'daily';
      /* 月常自成一页（2026-09-15 用户需求）：此前与周常同在本周页，但两者刷新口径不同 ——
         周常周一 0 点、月常每月 1 日 0 点，混在一起时"哪几条下周才会翻篇"看不出来 */
      if (target === 'month') return it.cycle === 'monthly';
      /* version / season 不在周页（2026-09-11 用户决策）：这两类随版本/赛季滚动、无固定截止，
         挪到限时页的「版本 / 赛季」分区（见 LimitedPage）。
         统计口径不受影响 —— domain/stats 的 month 仍覆盖这两个周期 */
      return it.cycle === 'weekly';
    });

    /* 分组成员**豁免下面的视图筛选**（2026-09-24，用户报"地域鬼王怎么还是没有合并"）：
       覆盖设置会触发「隐藏被覆盖项」、条目还可能带 `days` 只在某几天适用，而当时还有一个
       **没有 UI 却仍生效**的「隐藏已完成」（同日已整体删除）—— 无论哪一条把组里的成员
       滤掉，那个三步任务就会**静默散成几张卡**，且只有动过的那一组出问题（没动过的组
       不缺口，于是看起来像"偶然"）。过滤器只能决定"这条自己显不显示"，不能决定
       "这个分组存不存在"。
       传进去的是 `inScope`（**条目库层**）：被用户在「条目管理」里手动隐藏的条目本来就
       不在其中，不会被复活 —— 那是用户的明确取舍，复活了还会被误勾。

       粒度也定死：分组是**一个单元**，要么整张在、要么整张不在 —— 不做"只藏一半"
       （全组完成时它照旧整张进「已完成」段）。

       coverMode 的另一半口径不变：它只影响**列表渲染**，绝不进入统计与漏失口径
       （那是 domain/stats 的事，被覆盖项照样计入）；入口自身也永不被隐藏，
       否则整块入口会连着自己一起消失。 */
    const groupMates = groupedMemberIds(inScope);

    const sorted = inScope
      .filter((it) =>
        groupMates.has(it.id)
          ? true
          : !hiddenByCover(it, coveredSet, coverMode) && isVisible(it, visibility),
      )
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
      total: rest.length,
      coveredSet,
      coverMode,
    };
  }, [items, checked, view, orderKey, target, coveredSet, coverMode, guildTime]);
}
