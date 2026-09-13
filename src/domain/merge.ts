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
import { mergeChecked, type ResetCtx } from './reset';

export { mergeChecked };
export type { ResetCtx };

/** 种子条目 + 覆盖层 → 有效条目：先隐藏预设，再追加自建（自建条目一律 origin='custom'） */
export function mergeItems(seed: Item[], ov: ItemOverrides): Item[] {
  const hidden = new Set(ov.hidden || []);
  const base = seed.filter((it) => !hidden.has(it.id));
  const custom = (ov.custom || []).map((it) => ({ ...it, origin: 'custom' as const }));
  return [...base, ...custom];
}

/**
 * 视图偏好：默认值（meta.viewDefaults）与档案偏好合并。
 * 档案里缺失或非法的字段回落默认值 —— 保证升级数据结构后旧偏好不会把 UI 卡死。
 */
export function effectiveView(defaults: ViewDefaults, pref?: Partial<ViewPrefs> | null): ViewPrefs {
  const p = pref || {};
  return {
    profileId: p.profileId ?? '',
    sortBy: p.sortBy ?? defaults.sortBy,
    showKinds: Array.isArray(p.showKinds) ? p.showKinds : [...defaults.showKinds],
    minWeight: typeof p.minWeight === 'number' && p.minWeight >= 0 ? p.minWeight : defaults.minWeight,
    hideDone: typeof p.hideDone === 'boolean' ? p.hideDone : defaults.hideDone,
    pinned: Array.isArray(p.pinned) ? p.pinned : [...defaults.pinned],
    coverMode: p.coverMode ?? 'dim',
    /* 一键日常覆盖集合：未自定义时**保持 undefined**（不是回落为空数组）——
       undefined 的语义是「跟随数据默认」，由 domain/autoDaily.effectiveAutoSet 归一。 */
    autoSet: Array.isArray(p.autoSet) ? [...p.autoSet] : undefined,
    updatedAt: p.updatedAt ?? '',
  };
}

/** 用户数据覆盖层的空骨架（新建档案时初始化三份空数据用） */
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
