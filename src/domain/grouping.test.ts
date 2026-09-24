/**
 * 渲染层聚合单测（`domain/grouping`）。
 *
 * 这里锁的是**"推不出来就不聚合"**这条纪律：聚合是纯推导（数据一行不改），
 * 推导依据只有名字与 cycle/path，所以每一条不确定的情形都必须退回单条 ——
 * 错聚合比不聚合糟得多（用户会看到一条"1/3"的卡却凑不齐三步）。
 */
import { describe, expect, it } from 'vitest';
import { groupByCount, groupChecklist, groupedMemberIds, unitProgress } from './grouping';
import type { Item } from '../api/types';

const item = (over: Partial<Item>): Item => ({
  id: 'x',
  name: '测试条目',
  cycle: 'daily',
  origin: 'preset',
  ...over,
});

const demon = (k: number, n = 3) =>
  item({
    id: `daily_demon_lord_${k}`,
    name: `地域鬼王 ${k}/${n}`,
    path: '探索 → 地域鬼王',
  });

describe('groupByCount', () => {
  it('三条齐全 → 折成一张卡，组内按 k 升序（即使输入是乱序的）', () => {
    const units = groupByCount([demon(3), demon(1), demon(2)]);
    expect(units).toHaveLength(1);
    expect(units[0].grouped).toBe(true);
    expect(units[0].label).toBe('地域鬼王');
    expect(units[0].total).toBe(3);
    expect(units[0].items.map((it) => it.id)).toEqual([
      'daily_demon_lord_1',
      'daily_demon_lord_2',
      'daily_demon_lord_3',
    ]);
  });

  it('缺一条 → 仍然聚合，进度按可见步数（2026-09-24 修订：缺员不再拆散分组）', () => {
    /* 这条是用户两次反馈的那个 bug 的根：`1/3` 被视图筛选（隐藏已完成）或用户手动隐藏
       吃掉后，旧规则要求"凑齐 1..N"，于是 2/3 与 3/3 反而散成两张卡 ——
       而没动过的组不缺口，于是表现为"只有地域鬼王不合并"。缺员是常态，不该阻塞聚合。 */
    const units = groupByCount([demon(1), demon(3)]);
    expect(units).toHaveLength(1);
    expect(units[0].grouped).toBe(true);
    expect(units[0].label).toBe('地域鬼王');
    /* 进度按**可见步数**：宁可按 2 步做完，也不要按 3 步算却永远做不完 */
    expect(units[0].total).toBe(2);
    expect(units[0].items.map((it) => it.id)).toEqual(['daily_demon_lord_1', 'daily_demon_lord_3']);
  });

  it('周期不同 → 不聚合（同一件事不可能既每日又每周）', () => {
    const units = groupByCount([
      item({ id: 'a1', name: '真·八岐大蛇 1/2', cycle: 'weekly', path: '探索 → 真·八岐大蛇' }),
      item({ id: 'a2', name: '真·八岐大蛇 2/2', cycle: 'daily', path: '探索 → 真·八岐大蛇' }),
    ]);
    expect(units).toHaveLength(2);
    expect(units.every((u) => !u.grouped)).toBe(true);
  });

  it('入口不同 → 不聚合', () => {
    const units = groupByCount([
      item({ id: 'a1', name: '阴阳寮宴会 1/2', cycle: 'weekly', path: '阴阳寮 → 宴会' }),
      item({ id: 'a2', name: '阴阳寮宴会 2/2', cycle: 'weekly', path: '庭院 → 宴会' }),
    ]);
    expect(units.every((u) => !u.grouped)).toBe(true);
  });

  it('同一个 k 出现两次 → 整堆退回单条（不猜哪条是对的）', () => {
    const units = groupByCount([demon(1), demon(1), demon(2), demon(3)]);
    expect(units).toHaveLength(4);
    expect(units.every((u) => !u.grouped)).toBe(true);
  });

  it('名字不含 k/N → 单条，且顺序原样保留', () => {
    const units = groupByCount([
      item({ id: 'p1', name: '地域鬼王分享', path: '地域鬼王结算 → 分享' }),
      demon(1),
      item({ id: 'p2', name: '每日签到任务' }),
      demon(2),
      demon(3),
    ]);
    expect(units.map((u) => u.label)).toEqual(['地域鬼王分享', '地域鬼王', '每日签到任务']);
    expect(units.map((u) => u.grouped)).toEqual([false, true, false]);
  });

  it('组名里带空格也能解析（非贪婪 + 末尾锚点）', () => {
    const units = groupByCount([
      item({ id: 'b1', name: '周末 首领退治 1/2', cycle: 'weekly' }),
      item({ id: 'b2', name: '周末 首领退治 2/2', cycle: 'weekly' }),
    ]);
    expect(units).toHaveLength(1);
    expect(units[0].label).toBe('周末 首领退治');
  });

  it('N = 1 不聚合（`x 1/1` 与普通条目无异）', () => {
    const units = groupByCount([item({ id: 'c1', name: '结界突破 1/1' })]);
    expect(units[0].grouped).toBe(false);
    expect(units[0].total).toBe(1);
  });

  it('单条单元的 key 用 id，聚合单元的 key 带组名（React key 稳定且不撞）', () => {
    const units = groupByCount([item({ id: 'solo', name: '单独条目' }), demon(1), demon(2), demon(3)]);
    expect(units[0].key).toBe('solo');
    expect(units[1].key).toContain('group:地域鬼王');
  });

  it('组名相同但周期不同 → 两张卡，且 key 不撞（只用组名当 key 会在这里撞车）', () => {
    const units = groupByCount([
      item({ id: 'd1', name: '宴会 1/2', cycle: 'daily', path: 'x' }),
      item({ id: 'd2', name: '宴会 2/2', cycle: 'daily', path: 'x' }),
      item({ id: 'w1', name: '宴会 1/2', cycle: 'weekly', path: 'x' }),
      item({ id: 'w2', name: '宴会 2/2', cycle: 'weekly', path: 'x' }),
    ]);
    expect(units).toHaveLength(2);
    expect(units.every((u) => u.grouped)).toBe(true);
    expect(new Set(units.map((u) => u.key)).size).toBe(2);
  });
});

describe('groupChecklist（按"卡"切分待做 / 已完成）', () => {
  it('勾掉 1/3 之后，那一组仍然是一张待做的卡（不能散成两张）', () => {
    /* 这就是用户报的那个 bug：分开算时 pending=[2/3,3/3] 凑不齐 1..N，整堆退回单条 */
    const { pending, done } = groupChecklist([demon(2), demon(3)], [demon(1)]);
    expect(pending).toHaveLength(1);
    expect(pending[0].grouped).toBe(true);
    expect(pending[0].total).toBe(3);
    expect(done).toHaveLength(0);
  });

  it('整组完成后整张卡进已完成（而不是三个成员各占一行）', () => {
    const { pending, done } = groupChecklist([], [demon(1), demon(2), demon(3)]);
    expect(pending).toHaveLength(0);
    expect(done).toHaveLength(1);
    expect(done[0].grouped).toBe(true);
  });

  it('单条条目的待做 / 已完成归属不受影响', () => {
    const solo = item({ id: 'solo', name: '单独条目' });
    const fin = item({ id: 'fin', name: '已完成的单独条目' });
    /* `demon(1)` 只有孤零零一步 —— 按"单成员退回单条"当普通单条处理；
       它已勾选，所以与 `fin` 一起落在已完成（这里同时锁住"孤立的 k/N 也是单条"这条边） */
    const { pending, done } = groupChecklist([solo], [fin, demon(1)]);
    expect(pending.map((u) => u.key)).toEqual(['solo']);
    expect(done.map((u) => u.key)).toEqual(['fin', 'daily_demon_lord_1']);
  });
});

describe('groupedMemberIds（让视图筛选不得拆散分组）', () => {
  it('给出分组全部成员的 id；非 k/N 命名与周期不同的散条不进来', () => {
    const ids = groupedMemberIds([
      demon(1),
      demon(2),
      demon(3),
      item({ id: 'solo', name: '地域鬼王分享', cycle: 'weekly', path: '地域鬼王结算 → 分享' }),
      item({ id: 'w1', name: '真·八岐大蛇 1/2', cycle: 'weekly', path: 'x' }),
    ]);
    expect([...ids].sort()).toEqual([
      'daily_demon_lord_1',
      'daily_demon_lord_2',
      'daily_demon_lord_3',
    ]);
  });

  it('只有 1 个成员的堆不算分组 —— 否则那条会永远豁免过滤（等于隐藏不掉）', () => {
    expect(groupedMemberIds([item({ id: 'half', name: '孤儿 1/2', path: 'x' })]).size).toBe(0);
  });
});

describe('unitProgress', () => {
  it('组内已完成条数 = 进度（进度就是真实勾选，不是另记的计数）', () => {
    const [unit] = groupByCount([demon(1), demon(2), demon(3)]);
    const done = new Set(['daily_demon_lord_1']);
    expect(unitProgress(unit, (id) => done.has(id))).toBe(1);
    expect(unitProgress(unit, () => true)).toBe(3);
    expect(unitProgress(unit, () => false)).toBe(0);
  });
});
