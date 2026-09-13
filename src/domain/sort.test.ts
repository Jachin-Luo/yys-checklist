/**
 * 排序相关纯函数单测：
 *   - `effectiveSortBy`：产品决策 —— 不再让用户选排序，默认痛感，自定义顺序直接接管
 *   - `seedOrder` / `moveWithinGroup` / `moveBefore` / `moveAfter`：F20 自定义排序（新条目自动沉底）
 */
import { describe, expect, it } from 'vitest';
import { effectiveSortBy, moveAfter, moveBefore, moveWithinGroup, seedOrder } from './sort';
import type { Item } from '../api/types';

const mk = (over: Partial<Item>): Item => ({
  id: 'x', name: '条目', cycle: 'daily', origin: 'preset', ...over,
});

const ITEMS: Item[] = [
  mk({ id: 'low', name: '每日金币', cycle: 'daily' }),
  mk({ id: 'high', name: '月度黑蛋', cycle: 'monthly', gain: { blackFrag: 1 } }),
  mk({ id: 'hub', name: '一键日常', isAutoHub: true }),
];

describe('effectiveSortBy', () => {
  it('没有自定义顺序 → 痛感（默认）', () => {
    expect(effectiveSortBy([])).toBe('weight');
  });

  it('有自定义顺序 → 自定义接管默认（不再看 view.sortBy）', () => {
    expect(effectiveSortBy(['daily_sign', 'daily_free_draw'])).toBe('custom');
  });

  it('自定义顺序被清空（恢复默认条目库）→ 退回痛感', () => {
    expect(effectiveSortBy(['daily_sign'])).toBe('custom');
    expect(effectiveSortBy([])).toBe('weight');
  });
});

describe('seedOrder：首次进入自定义排序的全序种子', () => {
  it('按痛感降序铺全序，入口仍恒第 0 位', () => {
    expect(seedOrder(ITEMS)).toEqual(['hub', 'high', 'low']);
  });

  it('生成的是完整全序（不是空数组），否则用户点 ▲▼ 看不到任何变化', () => {
    expect(seedOrder(ITEMS).length).toBe(ITEMS.length);
  });
});

describe('moveWithinGroup：组内上移 / 下移', () => {
  const seed = ['a', 'b', 'c'];

  it('组内下移一项', () => {
    expect(moveWithinGroup(seed, seed, 'a', 1, seed)).toEqual(['b', 'a', 'c']);
  });

  it('组内上移一项', () => {
    expect(moveWithinGroup(seed, seed, 'c', -1, seed)).toEqual(['a', 'c', 'b']);
  });

  it('边界：组内首项上移、末项下移都是原样返回', () => {
    expect(moveWithinGroup(seed, seed, 'a', -1, seed)).toEqual(seed);
    expect(moveWithinGroup(seed, seed, 'c', 1, seed)).toEqual(seed);
  });

  it('只在组内换位，不跨越他组条目', () => {
    /* 全局 order 是 a,b,c；分组只含 a 与 c（b 属另一个周期）→ a 下移应落到 c 之后 */
    expect(moveWithinGroup(['a', 'b', 'c'], ['a', 'c'], 'a', 1, ['a', 'b', 'c'])).toEqual(['b', 'c', 'a']);
    /* 他组条目（x、y）夹在中间时：c 上移只跨过组内的 a，x、y 的相对位置不受影响 */
    expect(moveWithinGroup(['a', 'x', 'y', 'c'], ['a', 'c'], 'c', -1, ['a', 'x', 'y', 'c'])).toEqual(['c', 'a', 'x', 'y']);
  });

  it('组边界处不动（跨周期调序没有意义，界面也看不出变化）', () => {
    expect(moveWithinGroup(['a', 'b', 'c'], ['a', 'c'], 'a', -1, ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(moveWithinGroup(['a', 'b', 'c'], ['a', 'c'], 'c', 1, ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('order 为空时以 seed 补齐后再移动', () => {
    expect(moveWithinGroup([], seed, 'b', -1, seed)).toEqual(['b', 'a', 'c']);
  });

  it('order 中缺失的条目按 seed 顺序补到末尾（新条目不打乱已有顺序）', () => {
    /* order 只记了 c → 补齐后为 ['c','a','b']：c 仍在前，a、b 按 seed 顺序追加到末尾 */
    expect(moveWithinGroup(['c'], ['a', 'b', 'c'], 'a', -1, ['a', 'b', 'c'])).toEqual(['c', 'a', 'b']);
  });

  it('id 不在组里时原样返回（防御：分组与 order 暂时不同步）', () => {
    expect(moveWithinGroup(seed, ['a'], 'ghost', 1, seed)).toEqual(seed);
  });

  it('返回新数组，不修改入参（便于乐观更新与回滚）', () => {
    const input = [...seed];
    moveWithinGroup(input, seed, 'a', 1, seed);
    expect(input).toEqual(seed);
  });
});

describe('moveBefore / moveAfter：PC 拖放', () => {
  const seed = ['a', 'b', 'c', 'd'];

  it('moveBefore 把 from 插到 to 之前', () => {
    expect(moveBefore(seed, 'd', 'b', seed)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moveAfter 把 from 插到 to 之后（组内下移到最后一个需要它）', () => {
    expect(moveAfter(seed, 'a', 'c', seed)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('拖到自己身上不产生变化', () => {
    expect(moveBefore(seed, 'b', 'b', seed)).toEqual(seed);
    expect(moveAfter(seed, 'b', 'b', seed)).toEqual(seed);
  });

  it('目标不存在时沉底', () => {
    expect(moveBefore(seed, 'a', 'ghost', seed)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveAfter(seed, 'a', 'ghost', seed)).toEqual(['b', 'c', 'd', 'a']);
  });
});
