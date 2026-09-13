/**
 * 寮时间叠加 —— 纯函数，可单测（需求 §5-D3：道馆 / 宴会 / 退治 / 阴界各寮自定，**写死即错**）。
 *
 * 关键决定：用户配置的寮时间**不改主数据**，而是在展示层做一次叠加。
 * 理由：主数据里的 `time` 只是"参考值"（`isGuildTime: true` 已在数据里标明），
 * 把它写回 `items.db.json` 会让换寮/换号的用户拿到前一个人的时间；
 * 而寮时间属于**设备/人**的属性（见 `services/localStore.DEVICE_KEY`）。
 */
import type { Item } from '../api/types';

/** 设备级寮时间偏好：`itemId -> 'HH:mm'` */
export type GuildTimePrefs = Record<string, string>;

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
