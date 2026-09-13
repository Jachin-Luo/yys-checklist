/**
 * 一键日常纯函数单测：覆盖集合归一、覆盖判定、级联目标计算。
 * 边界：入口自身、不存在的 id、重复 id、显式空数组、coverMode 不参与计算。
 */
import { describe, expect, it } from 'vitest';
import {
  cascadeBatch,
  cascadeTargets,
  dataDefaultAutoSet,
  effectiveAutoSet,
  hiddenByCover,
  hubItem,
  isAutoDailyCandidate,
  isCovered,
} from './autoDaily';
import type { Item } from '../api/types';

const mk = (over: Partial<Item>): Item => ({
  id: 'x', name: '条目', cycle: 'daily', origin: 'preset', ...over,
});

const HUB = mk({ id: 'daily_auto_daily', name: '庭院事务·一键日常', isAutoHub: true });
const SIGN = mk({ id: 'daily_sign', name: '每日签到', autoDaily: true });
const DRAW = mk({ id: 'daily_free_draw', name: '每日免费一抽', autoDaily: true });
const FENGMO = mk({ id: 'daily_fengmo', name: '逢魔之时' });
const EVENT_UNTIL = mk({ id: 'daily_event_until', autoDaily: true, until: '2026-09-30' });
const EVENT_DEADLINE = mk({ id: 'daily_event_deadline', autoDaily: true, deadline: '2026-09-29 23:59' });
const WEEKLY = mk({ id: 'weekly_shop', cycle: 'weekly', autoDaily: true });
const EXCLUDED_ITEMS = [EVENT_UNTIL, EVENT_DEADLINE, WEEKLY];

/* 故意把入口也标上 autoDaily：数据里不会这么写，但要保证它永远不进覆盖集合 */
const HUB_WITH_FLAG = mk({ id: 'daily_auto_daily', isAutoHub: true, autoDaily: true });
const ITEMS: Item[] = [HUB, SIGN, DRAW, FENGMO];

describe('isAutoDailyCandidate：仅常驻每日可配置覆盖', () => {
  it('常驻每日可选，不要求已标 autoDaily，也支持自建条目', () => {
    expect(isAutoDailyCandidate(SIGN)).toBe(true);
    expect(isAutoDailyCandidate(FENGMO)).toBe(true);
    expect(isAutoDailyCandidate(mk({ origin: 'custom' }))).toBe(true);
  });

  it('排除入口、带下线日或截止日的每日任务，以及非每日条目', () => {
    for (const item of [HUB_WITH_FLAG, ...EXCLUDED_ITEMS, mk({ cycle: 'limited' })]) {
      expect(isAutoDailyCandidate(item)).toBe(false);
    }
  });
});

describe('dataDefaultAutoSet：数据默认覆盖集合', () => {
  it('取 autoDaily 且排除入口自身', () => {
    expect(dataDefaultAutoSet(ITEMS)).toEqual([SIGN.id, DRAW.id]);
    expect(dataDefaultAutoSet([HUB_WITH_FLAG, SIGN])).toEqual([SIGN.id]);
  });

  it('无任何 autoDaily 条目时为空数组', () => {
    expect(dataDefaultAutoSet([HUB, FENGMO])).toEqual([]);
  });

  it('活动期每日及非每日即使误标 autoDaily，也不进入默认覆盖集合', () => {
    expect(dataDefaultAutoSet([...ITEMS, ...EXCLUDED_ITEMS])).toEqual([SIGN.id, DRAW.id]);
  });
});

describe('effectiveAutoSet：归一（未自定义 → 数据默认）', () => {
  it('autoSet 为 undefined → 回落数据默认', () => {
    expect(effectiveAutoSet(ITEMS, { autoSet: undefined })).toEqual([SIGN.id, DRAW.id]);
    expect(effectiveAutoSet(ITEMS, null)).toEqual([SIGN.id, DRAW.id]);
    expect(effectiveAutoSet(ITEMS)).toEqual([SIGN.id, DRAW.id]);
  });

  it('显式数组以用户配置为准；显式空数组 = 全部关掉（不回落默认）', () => {
    expect(effectiveAutoSet(ITEMS, { autoSet: [DRAW.id] })).toEqual([DRAW.id]);
    expect(effectiveAutoSet(ITEMS, { autoSet: [FENGMO.id] })).toEqual([FENGMO.id]);
    expect(effectiveAutoSet(ITEMS, { autoSet: [] })).toEqual([]);
    expect(effectiveAutoSet([HUB_WITH_FLAG], { autoSet: [HUB_WITH_FLAG.id] })).toEqual([]);
  });

  it('剔除已不存在的 id，并对重复项去重', () => {
    expect(effectiveAutoSet(ITEMS, { autoSet: [SIGN.id, 'ghost_item', SIGN.id] })).toEqual([SIGN.id]);
  });

  it('旧配置只保留常驻每日，不修改传入配置', () => {
    const autoSet = [SIGN.id, EVENT_UNTIL.id, HUB.id, EVENT_DEADLINE.id, WEEKLY.id];
    const snapshot = [...autoSet];
    expect(effectiveAutoSet([...ITEMS, ...EXCLUDED_ITEMS], { autoSet })).toEqual([SIGN.id]);
    expect(autoSet).toEqual(snapshot);
  });

  it('旧配置只含活动任务时得到空集合，不回落到数据默认', () => {
    expect(effectiveAutoSet([...ITEMS, EVENT_UNTIL], { autoSet: [EVENT_UNTIL.id] })).toEqual([]);
  });

  it('coverMode 不参与计算 —— dim 与 hide 得到同一集合（hide 不得影响统计口径的输入）', () => {
    const dim = effectiveAutoSet(ITEMS, { autoSet: undefined });
    const hide = effectiveAutoSet(ITEMS, { autoSet: undefined });
    expect(dim).toEqual(hide);
  });
});

describe('isCovered / hubItem', () => {
  it('入口自身永远不算被覆盖', () => {
    const autoSet = [HUB.id, SIGN.id];
    expect(isCovered(HUB, autoSet)).toBe(false);
    expect(isCovered(SIGN, autoSet)).toBe(true);
    expect(isCovered(FENGMO, autoSet)).toBe(false);
  });

  it('hubItem 找到唯一入口', () => {
    expect(hubItem(ITEMS)?.id).toBe(HUB.id);
    expect(hubItem([SIGN, DRAW])).toBeUndefined();
  });

  it('旧覆盖配置不会使活动任务或非每日条目被覆盖、隐藏', () => {
    const autoSet = [HUB.id, SIGN.id, ...EXCLUDED_ITEMS.map((item) => item.id)];
    for (const item of [HUB, ...EXCLUDED_ITEMS]) {
      expect(isCovered(item, autoSet)).toBe(false);
      expect(hiddenByCover(item, new Set(autoSet), 'hide')).toBe(false);
    }
  });

  it('常驻覆盖项仍按显示方式隐藏，未覆盖项不受影响', () => {
    const autoSet = new Set([SIGN.id]);
    expect(hiddenByCover(SIGN, autoSet, 'hide')).toBe(true);
    expect(hiddenByCover(SIGN, autoSet, 'dim')).toBe(false);
    expect(hiddenByCover(FENGMO, autoSet, 'hide')).toBe(false);
  });
});

describe('cascadeTargets / cascadeBatch：级联目标', () => {
  it('剔除入口自身、重复项与不存在的 id', () => {
    const autoSet = [SIGN.id, HUB.id, 'ghost_item', SIGN.id, DRAW.id];
    expect(cascadeTargets(ITEMS, HUB.id, autoSet)).toEqual([SIGN.id, DRAW.id]);
  });

  it('cascadeBatch = 入口在最前 + 覆盖目标', () => {
    expect(cascadeBatch(ITEMS, HUB.id, [SIGN.id, DRAW.id])).toEqual([HUB.id, SIGN.id, DRAW.id]);
  });

  it('未归一的旧覆盖集合也不能级联到活动任务或非每日条目', () => {
    const autoSet = [SIGN.id, ...EXCLUDED_ITEMS.map((item) => item.id)];
    expect(cascadeBatch([...ITEMS, ...EXCLUDED_ITEMS], HUB.id, autoSet)).toEqual([HUB.id, SIGN.id]);
  });

  it('空覆盖集合时只操作入口自身（不会误伤其它条目）', () => {
    expect(cascadeTargets(ITEMS, HUB.id, [])).toEqual([]);
    expect(cascadeBatch(ITEMS, HUB.id, [])).toEqual([HUB.id]);
  });
});
