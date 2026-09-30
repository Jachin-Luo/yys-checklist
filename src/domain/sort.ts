/**
 * 排序规则 —— 纯函数（设计文档 §4.2）。
 *
 * 优先级（`compare()` 的三个分支，顺序不可换）：
 *   ① 一键日常入口特判 —— `isAutoHub` 恒排第 0 位，**不参与任何比较**（D1）
 *   ② 用户 ☆ 置顶 —— 压过排序规则
 *   ③ 按 `sortBy` 规则：库顺序（默认）/ 周期 / 截止 / 自定义 / 名称
 *
 * ## 2026-09-30：默认排序由「痛感分降序」改为「条目库顺序」
 *
 * 用户原话："默认排序不用痛感算法了，就按照 db 的顺序来就行"。
 * 于是 `weightOf`（周期权重 + 稀缺性 + 固定收益三档加分）整体退场 ——
 * 它在库里**没有作者**：分数是派生的，用户改不了它，也无从预期"为什么这条在上面"。
 * 改完之后清单的默认长相 = `items.db.json` / `limited.db.json` 的书写顺序
 * （活动批就按活动批的顺序），**排列这件事完全交还给数据文件的作者**。
 *
 * 随之改变的是兜底口径：以前同分要依次比 `deadline` → 周期 → 自定义顺序，
 * 现在**库内索引本来就是全序**（每个 id 只有一个位置），默认分支一次比较到底，
 * 不需要任何同分兜底。其它规则（周期 / 截止 / 名称）的次键也一律换成库内索引 ——
 * 它们不再是"可用选项"，只是保持结果确定的兜底。
 */
import type { Item } from '../api/types';
import type { Cycle, SortBy } from './enums';
import { parseTs } from './countdown';

export interface SortContext {
  sortBy: SortBy;
  pinned: string[];
  order: string[];
  /**
   * **条目在库里的原始顺序**（`items` 数组下标，含追加在末尾的自建条目）。
   * 默认排序直接用它；其余规则的次键也用它 —— 保证同一份数据每次排出同一个结果。
   */
  dbIndex: ReadonlyMap<string, number>;
}

/**
 * 生效排序方式（产品决策）：**不再让用户选排序**。
 * 默认按**条目库顺序**；用户一旦拖拽调过顺序（`order` 非空），自定义顺序**直接接管**。
 *
 * 因此 `ViewPrefs.sortBy` 不再由 UI 写入 —— 字段保留是为了不动契约形状与既有校验，
 * 实际排序一律走本函数派生。
 */
export function effectiveSortBy(order: readonly string[]): SortBy {
  return order.length ? 'custom' : 'db';
}

/**
 * 首次进入自定义排序时的全序种子：按当前生效排序（库顺序）铺一遍，用户再在此基础上微调。
 * 直接生成顺序而不是空数组 —— 空 `order` 等于没排序，用户点 ▲▼ 会看不到任何变化。
 */
export function seedOrder(items: Item[], pinned: readonly string[] = []): string[] {
  const dbIndex = new Map(items.map((it, i) => [it.id, i] as const));
  return [...items]
    .sort(buildComparator({ sortBy: 'db', pinned: [...pinned], order: [], dbIndex }))
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

/**
 * 周期排序权重（**仅作兜底**；越小越靠前）。
 * 2026-09-30 从 `domain/weight` 迁到本文件 —— 那边的 `weightOf` 已整体删除，
 * 剩下这一个"周期先后"的判据与排序规则同源，放在一起更不容易走散。
 */
export function cycleRank(it: Item): number {
  const order: Cycle[] = ['limited', 'monthly', 'weekly', 'daily'];
  const idx = order.indexOf(it.cycle);
  return idx < 0 ? order.length : idx;
}

/**
 * 有 `deadline` 的按剩余天数升序；**没有 `deadline` 但有 `until`（活动下线日）的按下线日排**。
 *
 * 回退是 2026-09-28 加的：活动期的每日任务改走限时页后（`cycle: 'limited'` + 子步骤记次数），
 * 它们只有 `until` 没有 `deadline` —— 不回退就整批沉到"截止未定"那一堆里，
 * 临时性的东西反而排在最后。两者都没有才沉底（数据未核实时不能装作快到了）。
 */
function deadlineRank(it: Item): number {
  const t = parseTs(it.deadline) ?? parseTs(it.until);
  return t === null ? Number.POSITIVE_INFINITY : t;
}

export function buildComparator(ctx: SortContext): (a: Item, b: Item) => number {
  const pinIndex = new Map(ctx.pinned.map((id, i) => [id, i] as const));
  const orderIndex = new Map(ctx.order.map((id, i) => [id, i] as const));
  /* 库内序号：默认排序的唯一依据，也是其余规则的兜底键。
     取不到（数据里没有这条——理论上不会出现）时沉底，而不是当成 0 抢到最前 */
  const dbOf = (it: Item) => ctx.dbIndex.get(it.id) ?? Number.MAX_SAFE_INTEGER;

  return (a, b) => {
    /* ① 一键日常入口：恒第 0 位 */
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
      /* 不在 order 里 = 新条目：按库内顺序排在自定义段之后 */
      return dbOf(a) - dbOf(b);
    }

    if (ctx.sortBy === 'name') return a.name.localeCompare(b.name, 'zh');

    if (ctx.sortBy === 'cycle') {
      return cycleRank(a) - cycleRank(b) || dbOf(a) - dbOf(b);
    }

    if (ctx.sortBy === 'deadline') {
      const da = deadlineRank(a);
      const db = deadlineRank(b);
      if (da !== db) return da - db;
      return dbOf(a) - dbOf(b);
    }

    /* 默认（`db`）：**条目库顺序** —— 数据文件里怎么写，清单就怎么显示。
       库内索引本身就是全序（一个 id 只有一个位置），所以这里一次比较到底，
       不需要 deadline / 周期 / 自定义顺序那三层旧兜底（2026-09-30 随痛感分一起退场）。 */
    return dbOf(a) - dbOf(b);
  };
}

/**
 * 列表是否可见（视图筛选）：
 *   - 今天是否适用（`days`）
 *
 * 2026-09-28 **删掉 `showKinds`（按奖励类型筛选）**：它是 `SHOW_KIND_FILTER` 开关
 * 拴着的最后一段代码 —— 开关与 `ViewBar` 组件当日已删，字段只余"契约形状不动"这一个
 * 理由留在数据层。留着它，下一个读者会以为"这里还有什么在按类型筛"，而调用方恒传空数组。
 *
 * 2026-09-15「痛感只用于默认排序」：原先的 `minWeight` 门槛已删除 ——
 * 痛感不再是筛选维度，只作排序键。**2026-09-30 连排序键也不再是**（改库顺序），
 * 痛感分整体退场（见文件头）。
 *
 * 2026-09-24 **删掉 `hideDone`，连同它的豁免口 `keepDone`**：它是全场唯一一条
 * "**界面上碰不到、代码里却仍生效**"的筛选 —— 用户既改不了它，也没有任何地方能看出
 * 它开着，而它会在聚合之前把已勾条目从数组里抽走（正是当年"分组静默散开"的成因之一 ——
 * 2026-09-28 起组关系写进 `Item.children`，这类"成员被滤掉"的问题从根上不存在了）。"已完成"在本项目的表达是**沉下去但仍在**
 * （`card-done` + 划朱线），不是消失 —— 页面上的「已完成」分区本身就是这个口径。
 * 当初为统计留的豁免口 `keepDone` 早已没有调用方（统计不经过本函数）。
 *
 * `checkedAt` 参数一并去掉：它此前只服务于 `hideDone`。留着它只会让下一个读者
 * 以为"这里还有什么在按状态筛"，而实际什么都不做。
 */
export interface VisibilityContext {
  today: number;
}

export function isVisible(it: Item, ctx: VisibilityContext): boolean {
  if (!it.isAutoHub) {
    if (it.days && it.days.length && !it.days.includes(ctx.today)) return false;
  }
  return true;
}
