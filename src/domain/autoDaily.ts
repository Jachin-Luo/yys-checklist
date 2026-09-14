/**
 * 一键日常：覆盖集合与级联目标 —— 纯函数，可单测。
 *
 * 背景（为什么需要本文件）：
 *   - 设计文档 §4.2 写了 `autoDaily` =「官方一键日常默认已覆盖，**用户可逐项覆盖**」，
 *     但 §4.6 的 `viewPrefs` 字段清单里**没有承载"用户覆盖结果"的字段**（原型用刷新即丢的内存
 *     变量 `autoSet` 顶替）—— 这是文档缺口，由 `ViewPrefs.autoSet` 补上；
 *   - 原型 `toggle()` 的 `closest()` 链不含 `.hub`，所以入口的勾选在原型里其实是坏的
 *     （点一下会抛错）。本轮明确语义：**双向级联**。
 *
 * 语义边界（重要）：
 *   - 覆盖集合是**配置**，勾选状态是**状态**。单独取消某个被覆盖项的勾选，
 *     **不会**自动把它移出覆盖集合（两者分离，避免"状态变化偷偷改配置"）。
 *   - `coverMode` 只决定列表怎么渲染，**不参与**本文件任何计算，也**不影响统计口径**。
 */
import type { Item, ViewPrefs } from '../api/types';

/** 一键日常入口本身（全库恰 1 条，`isAutoHub`） */
export function hubItem(items: Item[]): Item | undefined {
  return items.find((it) => it.isAutoHub);
}

/**
 * 可被一键日常覆盖的条目：**常驻每日 + 数据里标了 `autoDaily`**。
 * 活动判据与今日页一致：带 until 或 deadline 的每日任务不属于常驻。
 *
 * 2026-09-14 修正：此前只判「常驻每日」、不要求 `autoDaily`，于是配置界面把 35 条常驻每日
 * 全列出来 —— 斗技、逢魔之时、地域鬼王、麒麟狩猎、御魂副本这些**官方一键日常根本不会代做**
 * 的条目也能被勾进覆盖集合。危害不是"配置多余"：勾选入口时级联会把它们一并标成已完成，
 * 等于伪造进度（玩家没做，清单却显示完成）。
 * 现在判据与 README 的数据口径一致 —— 覆盖项就是数据里 `autoDaily` 标记的那些（当前 14 条）。
 */
export function isAutoDailyCandidate(item: Item): boolean {
  return item.cycle === 'daily' && !item.isAutoHub && !item.until && !item.deadline && Boolean(item.autoDaily);
}

/** 数据默认覆盖集合：全部「可被覆盖」的条目（`view.autoSet === undefined` 时回落此值） */
export function dataDefaultAutoSet(items: Item[]): string[] {
  return items.filter(isAutoDailyCandidate).map((it) => it.id);
}

/**
 * 归一后的覆盖集合：
 *   - `view.autoSet === undefined` → 回落数据默认（跟随主数据升级）
 *   - 显式数组（含 `[]`）→ 以用户配置为准
 * 两条路径均只保留「可被覆盖」的条目：**已失效的 id**（条目被删 / 下线 / 已不在当前数据里）
 * 与**未被官方一键日常覆盖的每日任务**都会自动失效。
 * 注意：这层过滤防的是**运行期**就会出现的脏数据（用户删条目、活动条目到期下线），
 * 不是为了兼容历史数据 —— 项目开发阶段不做跨版本兼容（AGENTS.md 红线第 9 条）。
 */
export function effectiveAutoSet(
  items: Item[],
  view?: Pick<ViewPrefs, 'autoSet'> | null,
): string[] {
  const custom = view?.autoSet;
  if (!Array.isArray(custom)) return dataDefaultAutoSet(items);
  const candidates = new Set(items.filter(isAutoDailyCandidate).map((it) => it.id));
  return [...new Set(custom)].filter((id) => candidates.has(id));
}

/** 该条目是否被一键日常覆盖（入口自身永远不算"被覆盖"） */
export function isCovered(item: Item, autoSet: readonly string[]): boolean {
  return isAutoDailyCandidate(item) && autoSet.includes(item.id);
}

/**
 * 列表是否应因「被覆盖 + hide」而隐藏。
 * 入口、活动期每日及其他非候选条目永不因覆盖设置隐藏；已失效的 id 也不会因此被隐藏。
 */
export function hiddenByCover(
  item: Item,
  autoSet: ReadonlySet<string>,
  coverMode: 'dim' | 'hide',
): boolean {
  return coverMode === 'hide' && isAutoDailyCandidate(item) && autoSet.has(item.id);
}

/**
 * 级联目标：覆盖集合中实际存在的「可被覆盖」条目。
 * 去重并剔除入口、活动任务、不存在的 id，以及**未被官方覆盖的每日任务** ——
 * 最后一个若被级联勾选，等于把玩家没做的任务标成已完成。
 */
export function cascadeTargets(
  items: Item[],
  hubId: string,
  autoSet: readonly string[],
): string[] {
  const candidates = new Set(items.filter(isAutoDailyCandidate).map((it) => it.id));
  const seen = new Set<string>([hubId]);
  const out: string[] = [];
  for (const id of autoSet) {
    if (seen.has(id) || !candidates.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 入口的级联勾选清单：[入口自身, ...被覆盖项]（同一批、同一时间戳） */
export function cascadeBatch(
  items: Item[],
  hubId: string,
  autoSet: readonly string[],
): string[] {
  return [hubId, ...cascadeTargets(items, hubId, autoSet)];
}
