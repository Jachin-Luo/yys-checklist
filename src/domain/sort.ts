/**
 * 排序规则 —— 纯函数（设计文档 §4.2）。
 *
 * 优先级（`compare()` 的三个分支，顺序不可换）：
 *   ① 一键日常入口特判 —— `isAutoHub` 恒排第 0 位，**不参与 weightOf 比较**（D1）
 *   ② 用户 ☆ 置顶 —— 压过排序规则
 *   ③ 按 `sortBy` 规则：痛感 / 周期 / 截止 / 自定义 / 名称
 *
 * 同分兜底：`deadline` 近的 → 周期 → 用户自定义顺序（§4.2）。
 */
import type { Item } from '../api/types';
import type { SortBy } from './enums';
import { parseTs } from './countdown';
import { cycleRank, weightOf } from './weight';

export interface SortContext {
  sortBy: SortBy;
  pinned: string[];
  order: string[];
}

/**
 * 生效排序方式（产品决策）：**不再让用户选排序**。
 * 默认按痛感分；用户一旦拖拽调过顺序（`order` 非空），自定义顺序**直接接管**默认。
 *
 * 因此 `ViewPrefs.sortBy` 不再由 UI 写入 —— 字段保留是为了不动契约形状与既有校验，
 * 实际排序一律走本函数派生。
 */
export function effectiveSortBy(order: readonly string[]): SortBy {
  return order.length ? 'custom' : 'weight';
}

/**
 * 首次进入自定义排序时的全序种子：按当前生效排序（痛感）铺一遍，用户再在此基础上微调。
 * 直接生成顺序而不是空数组 —— 空 `order` 等于没排序，用户点 ▲▼ 会看不到任何变化。
 */
export function seedOrder(items: Item[], pinned: readonly string[] = []): string[] {
  return [...items]
    .sort(buildComparator({ sortBy: 'weight', pinned: [...pinned], order: [] }))
    .map((it) => it.id);
}

/** 把 order 补全为「含 seed 中全部条目」的完整全序（新条目沉底，§4.1） */
function completeOrder(order: readonly string[], seed: readonly string[]): string[] {
  const base = order.length ? [...order] : [...seed];
  for (const id of seed) if (!base.includes(id)) base.push(id);
  return base;
}

/** 把 fromId 移动到 toId 之前（PC 拖放用） */
export function moveBefore(
  order: readonly string[],
  fromId: string,
  toId: string,
  seed: readonly string[],
): string[] {
  if (fromId === toId) return completeOrder(order, seed);
  const base = completeOrder(order, seed);
  const from = base.indexOf(fromId);
  if (from < 0) return base;
  base.splice(from, 1);
  const to = base.indexOf(toId);
  if (to < 0) base.push(fromId);
  else base.splice(to, 0, fromId);
  return base;
}

/** 把 fromId 移动到 toId 之后。**只有 `moveBefore` 时"移到组内最后一个"表达不出来** */
export function moveAfter(
  order: readonly string[],
  fromId: string,
  toId: string,
  seed: readonly string[],
): string[] {
  if (fromId === toId) return completeOrder(order, seed);
  const base = completeOrder(order, seed);
  const from = base.indexOf(fromId);
  if (from < 0) return base;
  base.splice(from, 1);
  const to = base.indexOf(toId);
  if (to < 0) base.push(fromId);
  else base.splice(to + 1, 0, fromId);
  return base;
}

/**
 * **组内**上移 / 下移（移动端 ▲▼）。`group` 是该条目所在分组的显示顺序
 * （同一 `cycle` 的条目，已按当前生效顺序排好）。
 *
 * 为什么不做跨组移动：条目管理页**按周期分组展示**（需求：与条目自身分类一致），
 * 跨组移动在界面上看不出任何变化（改的是全局 order 数组，而列表已按周期切开），
 * 用户会以为按钮失灵。周期之间的先后由 `cycle` 语义决定，不该由用户调。
 *
 * 已到组边界时原样返回；返回新数组，不改入参 —— 便于乐观更新与回滚。
 */
export function moveWithinGroup(
  order: readonly string[],
  group: readonly string[],
  id: string,
  dir: -1 | 1,
  seed: readonly string[],
): string[] {
  const i = group.indexOf(id);
  if (i < 0) return completeOrder(order, seed);
  const j = i + dir;
  if (j < 0 || j >= group.length) return completeOrder(order, seed);
  return dir < 0 ? moveBefore(order, id, group[j], seed) : moveAfter(order, id, group[j], seed);
}

/** 有截止日的按剩余天数升序，无截止的一律沉底（数据未核实时不能装作快到了） */
function deadlineRank(it: Item): number {
  const t = parseTs(it.deadline);
  return t === null ? Number.POSITIVE_INFINITY : t;
}

export function buildComparator(ctx: SortContext): (a: Item, b: Item) => number {
  const pinIndex = new Map(ctx.pinned.map((id, i) => [id, i] as const));
  const orderIndex = new Map(ctx.order.map((id, i) => [id, i] as const));

  return (a, b) => {
    /* ① 一键日常入口：恒第 0 位，不参与权重比较 */
    if (Boolean(a.isAutoHub) !== Boolean(b.isAutoHub)) return a.isAutoHub ? -1 : 1;

    /* ② 用户置顶 */
    const pa = pinIndex.get(a.id);
    const pb = pinIndex.get(b.id);
    if (pa !== undefined || pb !== undefined) {
      if (pa === undefined) return 1;
      if (pb === undefined) return -1;
      return pa - pb;
    }

    /* ③ 按 sortBy */
    if (ctx.sortBy === 'custom') {
      const oa = orderIndex.get(a.id);
      const ob = orderIndex.get(b.id);
      if (oa !== undefined || ob !== undefined) {
        if (oa === undefined) return 1; // 新条目没有历史位置 → 沉底
        if (ob === undefined) return -1;
        return oa - ob;
      }
      return weightOf(b) - weightOf(a);
    }

    if (ctx.sortBy === 'name') return a.name.localeCompare(b.name, 'zh');

    if (ctx.sortBy === 'cycle') {
      return cycleRank(a) - cycleRank(b) || weightOf(b) - weightOf(a);
    }

    if (ctx.sortBy === 'deadline') {
      const da = deadlineRank(a);
      const db = deadlineRank(b);
      if (da !== db) return da - db;
      return weightOf(b) - weightOf(a);
    }

    /* 默认：痛感分降序；同分兜底 deadline → 周期 → 自定义顺序 */
    const w = weightOf(b) - weightOf(a);
    if (w !== 0) return w;
    const da = deadlineRank(a);
    const db = deadlineRank(b);
    if (da !== db) return da - db;
    const c = cycleRank(a) - cycleRank(b);
    if (c !== 0) return c;
    const oa = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const ob = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return oa - ob;
  };
}

/**
 * 列表是否可见（视图筛选）：
 *   - 痛感门槛 `minWeight`（K1，默认 0 = 不过滤）
 *   - 奖励类型 `showKinds`（空数组 = 全部）
 *   - 隐藏已完成
 *   - 今天是否适用（`days`）
 *
 * `keepDone` 供统计 / 漏失场景豁免「隐藏已完成」——否则已勾的条目不算已获得，统计会归零。
 */
export interface VisibilityContext {
  showKinds: string[];
  minWeight: number;
  hideDone: boolean;
  keepDone?: boolean;
  today: number;
}

export function isVisible(it: Item, checkedAt: number | undefined, ctx: VisibilityContext): boolean {
  if (!it.isAutoHub) {
    if (weightOf(it) < ctx.minWeight) return false;
    if (ctx.showKinds.length && !(it.gainKind || []).some((k) => ctx.showKinds.includes(k))) return false;
    if (ctx.hideDone && !ctx.keepDone && checkedAt !== undefined) return false;
    if (it.days && it.days.length && !it.days.includes(ctx.today)) return false;
  }
  return true;
}
