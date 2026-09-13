/**
 * 寮时间叠加单测（需求 §5-D3）。
 * 语义：用户配置只在**展示层**叠加，**不写回主数据**；未配置就保留参考值。
 */
import { describe, expect, it } from 'vitest';
import {
  applyGuildTime,
  applyGuildTimeAll,
  configuredCount,
  guildTimeTargets,
  isValidHm,
  withGuildTime,
} from './guildTime';
import type { Item } from '../api/types';

const mk = (over: Partial<Item>): Item => ({
  id: 'x', name: '条目', cycle: 'daily', origin: 'preset', ...over,
});

const DAOGUAN = mk({ id: 'daily_daoguan', name: '道馆突破', isGuildTime: true, time: '19:30', timeNote: '寮自定' });
const YINJIE = mk({ id: 'daily_yinjiegate', name: '阴界之门', time: '19:00', timeEnd: '23:00' });
const BANQUET = mk({ id: 'weekly_banquet', name: '阴阳寮宴会', cycle: 'weekly', isGuildTime: true, time: '20:00' });
const ITEMS = [DAOGUAN, YINJIE, BANQUET];

describe('isValidHm', () => {
  it('接受 00:00–23:59', () => {
    expect(isValidHm('19:30')).toBe(true);
    expect(isValidHm('00:00')).toBe(true);
    expect(isValidHm('23:59')).toBe(true);
  });

  it('拒绝越界与非法格式', () => {
    expect(isValidHm('24:00')).toBe(false);
    expect(isValidHm('19:60')).toBe(false);
    expect(isValidHm('7:30')).toBe(false);
    expect(isValidHm('')).toBe(false);
    expect(isValidHm('晚上七点')).toBe(false);
  });
});

describe('guildTimeTargets / configuredCount', () => {
  it('只挑出需要用户配置的寮自定条目', () => {
    expect(guildTimeTargets(ITEMS).map((i) => i.id)).toEqual(['daily_daoguan', 'weekly_banquet']);
  });

  it('统计已配置条数（忽略非法值）', () => {
    expect(configuredCount(ITEMS, {})).toBe(0);
    expect(configuredCount(ITEMS, { daily_daoguan: '20:00', weekly_banquet: '乱填' })).toBe(1);
  });
});

describe('applyGuildTime：展示层叠加，不改主数据', () => {
  it('已配置 → 覆盖 time，并标注来源', () => {
    const out = applyGuildTime(DAOGUAN, { daily_daoguan: '20:15' });
    expect(out.time).toBe('20:15');
    expect(out.timeNote).toContain('你配置的时间');
    /* 原对象未被修改 */
    expect(DAOGUAN.time).toBe('19:30');
  });

  it('未配置 / 非法值 → 原样返回（保留数据里的参考值）', () => {
    expect(applyGuildTime(DAOGUAN, {})).toBe(DAOGUAN);
    expect(applyGuildTime(DAOGUAN, { daily_daoguan: '25:00' })).toBe(DAOGUAN);
  });

  it('非寮自定条目即使配了也不生效（不越界改别人的时间）', () => {
    expect(applyGuildTime(YINJIE, { daily_yinjiegate: '08:00' })).toBe(YINJIE);
  });

  it('applyGuildTimeAll：无配置时返回同一数组引用（避免无谓的重渲染）', () => {
    expect(applyGuildTimeAll(ITEMS, {})).toBe(ITEMS);
    const out = applyGuildTimeAll(ITEMS, { daily_daoguan: '20:15' });
    expect(out).not.toBe(ITEMS);
    expect(out.find((i) => i.id === 'daily_daoguan')?.time).toBe('20:15');
    expect(out.find((i) => i.id === 'daily_yinjiegate')?.time).toBe('19:00');
  });
});

describe('withGuildTime：写入 / 清除', () => {
  it('空字符串表示清除该条配置', () => {
    const a = withGuildTime({}, 'daily_daoguan', '20:00');
    expect(a).toEqual({ daily_daoguan: '20:00' });
    const b = withGuildTime(a, 'daily_daoguan', '  ');
    expect(b).toEqual({});
  });

  it('返回新对象，不修改入参', () => {
    const prefs = { daily_daoguan: '19:30' };
    withGuildTime(prefs, 'weekly_banquet', '20:30');
    expect(prefs).toEqual({ daily_daoguan: '19:30' });
  });
});
