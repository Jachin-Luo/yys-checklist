/**
 * 「种子 + 覆盖层 → 有效数据」的**合并规则** —— 纯函数，可单测。
 *
 * 为什么必须在 domain（设计文档 §2 修正）：
 *   合并是业务规则，不是 IO。放在 `api/mock/` 会让「接真实后端」时这段逻辑无处安放 ——
 *   后端不做「种子 + 覆盖」，它直接返回结果。
 *
 * 接后端那天：
 *   - 若服务端返回「已合并好的有效数据」→ 本文件退化为恒等函数；
 *   - 若服务端返回「主数据 + 覆盖层」两段（更贴近本设计）→ 本文件原样复用。
 *   两种形态都不需要改前端业务代码。
 */
import type { Item, ItemOverrides, Meta, ViewDefaults, ViewPrefs } from '../api/types';
import { effectiveCardDisplay } from './cardDisplay';
import { applyPatch, sanitizePatches } from './itemPatch';
import { mergeChecked, type ResetCtx } from './reset';

export { mergeChecked };
export type { ResetCtx };

/**
 * 修正条目里**已经不存在的周期取值** —— 规则一条：`once` / `version` / `season` → `limited`。
 *
 * 2026-09-28 枚举连续收口两次（删 `once`；删 `season` 并把 `version` 并进 `limited`）后新增。
 * 用户的自建条目存在**本机分片与备份文件**里，而录入下拉当时这几档都在
 * —— 存量数据里完全可能躺着 `cycle: 'once'` / `'version'`。
 * 不修正的话，那条目在界面上**无家可归**：所有清单页都按周期取数，没有任何一页会列出它；
 * 条目管理的档位是跟着数据走的，但"有哪些档"本身来自枚举，它同样不会给出这一档 ——
 * 结果是条目还在（`共 N 条` 里算着），却哪儿都找不到。
 *
 * 改成 `limited` 而不是丢弃：这两档在 `reset.ts` 里本来就是**同一个分支**
 * （不自动重置、只靠 `until` 归档），语义完全等价，改判后条目回到限时页继续可用。
 *
 * 归一放在**读取入口**（`mergeItems`），与 `sanitizePlans` 同一思路：分片字节与备份文件
 * 都可能来自旧版本，规则只写一处、每种来路都过它，且**不回写**存储
 * （读取时归一就够，回写会把"用户没动过的数据"变成一次写入）。
 */
export function normalizeItemCycle(it: Item): Item {
  /* 与已删除的枚举值比较，类型上已无交集 —— 必须绕开 TS 的"字面量不可能相等"判定 */
  const legacy = it.cycle as string;
  if (legacy !== 'once' && legacy !== 'version' && legacy !== 'season') return it;
  return { ...it, cycle: 'limited' };
}

/**
 * 种子条目 + 覆盖层 → 有效条目：先隐藏预设、再盖**字段改写**，最后追加自建
 * （自建条目一律 `origin='custom'`）。
 *
 * 顺序不能颠倒：改写是按 id 记的，被隐藏的条目改了也看不到；
 * 自建条目不走改写（它自己就在 `custom` 里，是用户原生数据而非"盖在种子上的层"）。
 * `patches` 缺席（旧分片 / 旧备份）按"没有改写"处理，不必迁移。
 */
export function mergeItems(seed: Item[], ov: ItemOverrides): Item[] {
  const hidden = new Set(ov.hidden || []);
  /* 改写表过一遍净化（与 `sanitizePlans` 同一思路）：本机分片的字节可能被改坏、
     也可能来自更早/更晚的版本；非法值在这里挡掉，不让它渗进渲染层 */
  const patches = sanitizePatches(ov.patches) ?? {};
  const base = seed
    .filter((it) => !hidden.has(it.id))
    .map((it) => applyPatch(it, patches[it.id]));
  /* 只有自建条目需要过归一：种子来自随包发布的 JSON（从未有过 `once`），
     自建来自本机分片 / 导入的备份 —— 后者才是旧版写入的落脚点 */
  const custom = (ov.custom || []).map((it) => ({
    ...normalizeItemCycle(it),
    origin: 'custom' as const,
  }));
  return [...base, ...custom];
}

/**
 * 视图偏好：默认值（meta.viewDefaults）与账号偏好合并。
 * 账号里缺失或非法的字段回落默认值 —— 保证升级数据结构后旧偏好不会把 UI 卡死。
 */
export function effectiveView(defaults: ViewDefaults, pref?: Partial<ViewPrefs> | null): ViewPrefs {
  const p = pref || {};
  return {
    profileId: p.profileId ?? '',
    sortBy: p.sortBy ?? defaults.sortBy,
    minWeight: typeof p.minWeight === 'number' && p.minWeight >= 0 ? p.minWeight : defaults.minWeight,
    pinned: Array.isArray(p.pinned) ? p.pinned : [...defaults.pinned],
    /* 卡片字段显示（2026-09-16）：老数据没有 `card`，这里补成"全部显示"，
       因此新字段的引入不改变任何现有观感 */
    card: effectiveCardDisplay(p.card),
    coverMode: p.coverMode ?? 'dim',
    /* 一键日常覆盖集合：未自定义时**保持 undefined**（不是回落为空数组）——
       undefined 的语义是「跟随数据默认」，由 domain/autoDaily.effectiveAutoSet 归一。 */
    autoSet: Array.isArray(p.autoSet) ? [...p.autoSet] : undefined,
    updatedAt: p.updatedAt ?? '',
  };
}

/** 用户数据覆盖层的空骨架（新建账号时初始化三份空数据用） */
export function emptyOverrides(profileId: string, updatedAt: string): ItemOverrides {
  return { profileId, custom: [], hidden: [], order: [], updatedAt };
}

/** 供 build 期 / 单测使用的组装入口：meta 表 + dicts + 视图默认值 → Meta */
export function buildMeta(
  metaRow: Omit<Meta, 'dicts' | 'sortOptions' | 'viewDefaults'>,
  dicts: Meta['dicts'],
  sortOptions: Meta['sortOptions'],
  viewDefaults: ViewDefaults,
): Meta {
  return { ...metaRow, dicts, sortOptions, viewDefaults };
}
