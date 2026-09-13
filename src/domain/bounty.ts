/**
 * 悬赏封印派生（设计文档 §4.4 / S6）—— 纯函数，无 IO。
 *
 * 数据是**规范化四表**（`shikigami` / `spots` / `shikigamiSpots` / `shikigamiClues`），
 * 因为式神与出处的关联是真多对多（一个式神在多处、一处有多个式神）。
 * 原型用的是已经拼好的 `BT.entries`；这里把「四表 → 可用视图」的 join 显式放在领域层，
 * 组件只做展示。实测 39 式神 / 64 出处 / 148 关联，零孤儿引用。
 *
 * 悬赏玩法决定了两个核心能力：
 *   1. **反查**：游戏只给"神秘妖怪"的特征词（"羽毛 扇"），要能反推是哪个式神 → `matchBounty`
 *   2. **并集**：同时接了几个悬赏，想知道有没有一个副本一次刷完 → `bountyUnion`
 */
import type { BountyDb } from '../api/types';

export interface BountySpotRef {
  spotId: string;
  name: string;
  kind: string;
  /** 该式神在此处需击杀的数量 */
  count: number;
}

export interface BountyEntry {
  id: string;
  name: string;
  /** 特征线索词（神秘妖怪反查用） */
  clues: string[];
  spots: BountySpotRef[];
}

export interface BountyUnionRow {
  spotId: string;
  name: string;
  kind: string;
  hits: { id: string; name: string; count: number }[];
  /** 该出处覆盖了**全部**已选式神 */
  full: boolean;
}

/** 四表 join 成可用的式神视图（每行含线索与出处） */
export function buildBountyEntries(db: BountyDb): BountyEntry[] {
  const cluesOf = new Map<string, string[]>();
  for (const c of db.shikigamiClues) {
    const list = cluesOf.get(c.shikigamiId);
    if (list) list.push(c.word);
    else cluesOf.set(c.shikigamiId, [c.word]);
  }

  const spotById = new Map(db.spots.map((s) => [s.id, s]));
  const spotsOf = new Map<string, BountySpotRef[]>();
  for (const r of db.shikigamiSpots) {
    const spot = spotById.get(r.spotId);
    if (!spot) continue; // 孤儿引用：跳过而不是渲染一个空名出处
    const ref: BountySpotRef = { spotId: spot.id, name: spot.name, kind: spot.kind, count: r.count };
    const list = spotsOf.get(r.shikigamiId);
    if (list) list.push(ref);
    else spotsOf.set(r.shikigamiId, [ref]);
  }

  return db.shikigami.map((s) => ({
    id: s.id,
    name: s.name,
    clues: cluesOf.get(s.id) ?? [],
    spots: spotsOf.get(s.id) ?? [],
  }));
}

/** 单个词是否命中：式神名或任一线索词。**双向 includes** —— 用户可能只记得"扇"或"风扇" */
function hitToken(e: BountyEntry, token: string): boolean {
  return e.name.includes(token) || e.clues.some((c) => c.includes(token) || token.includes(c));
}

/**
 * 搜索：空格分词后**取交集**（游戏一次给两个特征词，两个都要满足才是目标）。
 * 空查询返回空数组 —— 不返回全量，免得把 39 行全铺在结果区。
 */
export function matchBounty(entries: BountyEntry[], query: string): BountyEntry[] {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return entries.filter((e) => tokens.every((t) => hitToken(e, t)));
}

/**
 * 并集推荐：已选式神 → 共同出处。
 * 排序：**能全收的排最前**，其次按覆盖数降序 —— 用户要的就是"一把刷完"。
 */
export function bountyUnion(entries: BountyEntry[], selectedIds: string[]): BountyUnionRow[] {
  const picked = entries.filter((e) => selectedIds.includes(e.id));
  if (!picked.length) return [];

  const rows = new Map<string, BountyUnionRow>();
  for (const e of picked) {
    for (const s of e.spots) {
      const row = rows.get(s.spotId) ?? {
        spotId: s.spotId,
        name: s.name,
        kind: s.kind,
        hits: [],
        full: false,
      };
      row.hits.push({ id: e.id, name: e.name, count: s.count });
      rows.set(s.spotId, row);
    }
  }

  return [...rows.values()]
    .map((r) => ({ ...r, full: r.hits.length === picked.length }))
    .sort((a, b) => {
      if (a.full !== b.full) return a.full ? -1 : 1;
      return b.hits.length - a.hits.length;
    });
}

/** 能"一次刷完全部已选"的出处（`hits.length > 1` 才有意义 —— 只有一个式神时处处都算全收） */
export const fullCoverage = (rows: BountyUnionRow[]): BountyUnionRow[] =>
  rows.filter((r) => r.full && r.hits.length > 1);

/** 带匹配标记的式神行 */
export interface RankedEntry extends BountyEntry {
  /** 命中当前搜索（供 UI 高亮） */
  hit: boolean;
}

/**
 * 搜索时的名单排序：**置顶匹配项，但一行都不删**。
 *
 * 为什么不过滤（2026-09-10 用户反馈）：名单是常驻的可用集合，
 * 用户常常"边搜边顺手挑别的"。把不匹配的 38 个滤掉之后，这个动作就做不到了 ——
 * 搜索是**辅助定位**，不该收走可用集合。所以匹配项置顶 + 打标，其余留在原位并交由 UI 弱化。
 *
 * 无查询时全部 `hit: false` 且保持原顺序（不重排：没有搜索就没有"更相关"的语义）。
 */
export function pinMatches(entries: BountyEntry[], query: string): RankedEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return entries.map((e) => ({ ...e, hit: false }));

  const hitIds = new Set(matchBounty(entries, trimmed).map((e) => e.id));
  const hits: RankedEntry[] = [];
  const rest: RankedEntry[] = [];
  for (const e of entries) {
    const hit = hitIds.has(e.id);
    (hit ? hits : rest).push({ ...e, hit });
  }
  return [...hits, ...rest];
}
