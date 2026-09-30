import { useMemo } from 'react';
import type { CardDisplay, CardScope } from '../api/types';
import { effectiveCardDisplay } from '../domain/cardDisplay';
import { useUiStore } from '../stores/ui';
import { useViewStore } from '../stores/view';

/** 组件侧要用 `CardScope` 时从这里取，省得再各自 import 一次 `api/types` */
export type { CardScope };

/**
 * 取「当前页面」的卡片显示配置（2026-09-30 卡片配置按页拆分后新增）。
 *
 * ## 为什么要有这个 hook
 *
 * 卡片组件（`ChecklistItem` / `ChecklistGroupCard` / `HubCard`）过去各自写
 * `useViewStore((s) => s.view.card)` —— 那时一份配置谁读都一样，重复读取没有代价。
 * 按页拆开后，"我是哪一页"成了每个卡片都必须回答的问题，而答案不该由三个组件各写一遍：
 * 写岔了就会出现「今日页用了限时页的配置」这类**不会报错、只是看着不对**的问题。
 * 所以只留这一个出口。
 *
 * ## 缺省从导航派生
 *
 * 四个清单页的 `NavKey` 与 `CardScope` 同名（`today` / `week` / `month` / `limited`），
 * 所以不传 `scope` 就按当前页取。设置页的「效果预览」不在清单页里（那时 `nav` 是 `me`），
 * 它**显式传** `scope` —— 预览要跟着页签走，不能跟着导航走。
 */
const SCOPES: readonly CardScope[] = ['today', 'week', 'month', 'limited'];

export function useCardDisplay(scope?: CardScope): CardDisplay {
  const card = useViewStore((s) => s.view.card);
  const nav = useUiStore((s) => s.nav);
  const key = scope ?? (SCOPES.includes(nav as CardScope) ? (nav as CardScope) : 'today');
  /**
   * 归一化包在 `useMemo` 里：契约类型允许"缺页 / 缺字段"（老数据、手写的分片都算），
   * 而这里必须交出完整的 `CardDisplay`。用 memo 而不是每次新建 ——
   * 三个卡片组件都是 `memo` 的，交出一个新对象会让它们每次都重渲染。
   */
  return useMemo(() => effectiveCardDisplay(card?.[key]), [card, key]);
}
