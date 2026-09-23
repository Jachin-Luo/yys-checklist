/**
 * 寮时间叠加 —— 纯函数，可单测（需求 §5-D3：道馆 / 宴会 / 退治 / 阴界各寮自定，**写死即错**）。
 *
 * 关键决定：用户配置的寮时间**不改主数据**，而是在展示层做一次叠加。
 * 理由：主数据里的 `time` 只是"参考值"（`isGuildTime: true` 已在数据里标明），
 * 把它写回 `items.db.json` 会让换寮/换号的用户拿到前一个人的时间。
 *
 * 2026-09-16：寮时间由**设备级升为账号级**（用户决策）。原注释写的理由是"同一个寮"，
 * 但那只对"所有号都在自己寮"成立；代管他人的号、或两个号分处两寮时会互相污染。
 * 类型因此移到 `api/types`（`api/types` 不能反向 import 本文件 —— 它要 import 这里的
 * `Item` 作为输入），此处 re-export，既有 import 点不用改。
 */
import type { GuildTimePrefs, Item } from '../api/types';

export type { GuildTimePrefs };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidHm(value: string): boolean {
  return HHMM.test(value.trim());
}

/** 需要用户配置时间的条目（数据里 `isGuildTime: true`，当前 5 条） */
export function guildTimeTargets(items: Item[]): Item[] {
  return items.filter((it) => it.isGuildTime);
}

/** 已配置的时间条数（设置页与引导页的进度提示用） */
export function configuredCount(items: Item[], prefs: GuildTimePrefs): number {
  return guildTimeTargets(items).filter((it) => isValidHm(prefs[it.id] ?? '')).length;
}

/** 把用户配置的寮时间叠加到单个条目；未配置 / 非法则原样返回（保留数据里的参考值） */
export function applyGuildTime(item: Item, prefs: GuildTimePrefs): Item {
  const value = prefs[item.id];
  if (!item.isGuildTime || !value || !isValidHm(value)) return item;
  return { ...item, time: value.trim(), timeNote: '寮自定 · 你配置的时间' };
}

/** 批量叠加；没有配置时直接返回原数组（避免无谓的 map 与身份变化） */
export function applyGuildTimeAll(items: Item[], prefs: GuildTimePrefs): Item[] {
  if (!prefs || !Object.keys(prefs).length) return items;
  return items.map((it) => applyGuildTime(it, prefs));
}

/** 写入一条配置（返回新对象，便于乐观更新与回滚） */
export function withGuildTime(prefs: GuildTimePrefs, itemId: string, value: string): GuildTimePrefs {
  const next = { ...prefs };
  const trimmed = value.trim();
  if (!trimmed) delete next[itemId];
  else next[itemId] = trimmed;
  return next;
}
