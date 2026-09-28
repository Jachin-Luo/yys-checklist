import type { Item } from '../api/types';

/**
 * 子步骤：一张卡「做 N 次」的推进规则（2026-09-28 新增）。
 *
 * ## 它取代了什么
 *
 * 上一版（`domain/grouping`，2026-09-24）是**按名字猜分组**：数据里是 N 条平级条目，
 * 名字形如「地域鬼王 1/3」，渲染时把同名的几行并成一张卡。那层猜测带来一整套补丁 ——
 * 「缺员仍要聚合」（成员被视图筛选吃掉会散架）、「分组成员豁免视图筛选」、
 * 「按卡切分而不是按条切分」（否则做了一半的组必然散开）、
 * 「进度按可见步数算」…… 每一条都是在补"组关系不在数据里"这个洞。
 *
 * 现在组关系**写进数据**（`Item.children`）：一张卡就是一个条目，几步就是几个子步骤。
 * 于是上面那些补丁全部不需要了 —— 成员不可能被筛掉（它根本不是独立条目），
 * 组的存在性不可能依赖"此刻列表里还剩下谁"。本文件只剩**纯派生**，没有任何判定。
 *
 * ## 三条口径
 *
 *   1. **勾选态零改动**：子步骤就是普通 id，`Checked` 仍是 `Record<string, number>`，
 *      周期重置 / 同步复刻 / 备份 / 勾选日志一行都不用改。
 *   2. **整张卡是一个单元**：要么全做完（进「已完成」），要么只要有一步没做就留在待做
 *      —— 不做"半张卡在两段各出现一次"。
 *   3. **缺省继承父**：子步骤只写逐次不同的字段，其余用父的（`stepView` 是唯一实现处，
 *      别在各处自己写 `?? `，那必然漂移）。
 */
/** 是否「多次任务」（有子步骤）。单条条目恒 false，行为与旧版完全一致 */
export function isGroup(item: Item): boolean {
  return (item.children?.length ?? 0) > 0;
}

/** 步骤 id：有子步骤用子 id，否则就是条目自己。勾选 / 清除 / 复刻都按这些 id 走 */
export function stepIds(item: Item): string[] {
  return item.children?.length ? item.children.map((c) => c.id) : [item.id];
}

/** 步数（单条恒为 1） */
export function stepTotal(item: Item): number {
  return item.children?.length ?? 1;
}

/** 已完成步数 */
export function doneSteps(item: Item, isDone: (id: string) => boolean): number {
  return stepIds(item).reduce((n, id) => (isDone(id) ? n + 1 : n), 0);
}

/** 整张卡是否完成：所有步都做完才算（做了一半仍是一张待做的卡，卡上带进度） */
export function isCardDone(item: Item, isDone: (id: string) => boolean): boolean {
  return stepIds(item).every(isDone);
}

/**
 * 当前步下标：第一个未完成的步；**全做完了退回最后一步**。
 *
 * 退回是刻意的：满段后卡面仍要读得到那一步的说明（不能突然空掉），
 * 与 2026-09-24 聚合卡「满段后退回最后一步」同一条口径。
 */
export function currentStepIndex(item: Item, isDone: (id: string) => boolean): number {
  return Math.min(doneSteps(item, isDone), stepTotal(item) - 1);
}

/**
 * 第 `index` 步的**显示视图**：父条目字段打底，子步骤写了的字段盖上去。
 *
 * 卡片（显示当前步的奖励 / 条件 / 备注）与统计（每步各自的收益）都用它 ——
 * 「缺省继承父」只有这一处实现。
 *
 * ⚠️ 返回的 `id` 是**子步骤的 id**（单条时就是条目自己）：用于勾选与日志时要的就是它，
 * 用于排序 / 隐藏 / 置顶时请用父条目的 `id`（粒度锁在父，见 `SubItem` 的说明）。
 */
export function stepView(item: Item, index: number): Item {
  const child = item.children?.[index];
  return child ? { ...item, ...child } : item;
}
