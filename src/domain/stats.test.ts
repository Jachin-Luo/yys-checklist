/**
 * 统计单测。重点锁定三条口径纪律：
 *   ① 只统计固定数值（浮动收益不进分子分母）
 *   ② 被覆盖项照样计入（coverMode 不参与计算）
 *   ③ 不受任何列表筛选影响 —— 已勾条目的收益必须算进「已获得」，否则会归零
 *
 * 2026-09-15：漏失明细（`missGroups`）与其用例已随「痛感只用于默认排序」删除。
 */
import { describe, expect, it } from 'vitest';
import { periodItems, summarizeGain, summarizeRangeGain } from './stats';
import type { Item } from '../api/types';

const mk = (over: Partial<Item>): Item => ({
  id: 'x', name: '条目', cycle: 'daily', origin: 'preset', ...over,
});

const ITEMS: Item[] = [
  mk({ id: 'hub', name: '一键日常', isAutoHub: true, gainKind: ['other'] }),
  /* 日常：固定 20 勾玉 + 0.5 黑碎（小数必须被正确处理） */
  mk({ id: 'd_card', name: '永久勾玉卡', gain: { jade: 20 }, gainNote: '每6h返5勾', gainKind: ['jade'] }),
  mk({ id: 'd_daruma', name: '免费黑蛋礼包', gain: { blackFrag: 0.5 }, gainKind: ['blackFrag'], autoDaily: true }),
  /* 只有浮动收益 → 不进统计 */
  mk({ id: 'd_fengmo', name: '逢魔之时', gainKind: ['bossSoul'], autoDaily: true }),
  /* 周常：1 蓝票 */
  mk({ id: 'w_medal', name: '勋章商店蓝票', cycle: 'weekly', gain: { blueTicket: 1 }, gainKind: ['blueTicket'] }),
  /* 版本：25 黑碎（1 整颗黑蛋） */
  mk({ id: 'v_shop', name: '活动商店黑蛋', cycle: 'version', gain: { blackFrag: 25 }, gainKind: ['blackDaruma'], deadline: '2026-10-06' }),
];

describe('periodItems：统计口径的周期范围', () => {
  it('本日 = 日常；本周 = 周常；本月 = 每月 / 版本 / 赛季', () => {
    expect(periodItems(ITEMS, 'day').map((i) => i.id)).toContain('d_card');
    expect(periodItems(ITEMS, 'day').map((i) => i.id)).not.toContain('w_medal');
    expect(periodItems(ITEMS, 'week').map((i) => i.id)).toEqual(['w_medal']);
    expect(periodItems(ITEMS, 'month').map((i) => i.id)).toEqual(['v_shop']);
  });
});

describe('summarizeGain：固定收益汇总', () => {
  it('只统计有 gain 的条目；浮动收益条目不进分母', () => {
    const r = summarizeGain(ITEMS, {}, 'day');
    expect(r.rows.map((x) => x.id)).toEqual(['d_card', 'd_daruma']);
    expect(r.jade.total).toBe(20);
    expect(r.blackFrag.total).toBe(0.5);
    expect(r.jade.got).toBe(0);
    expect(r.jade.left).toBe(20);
    expect(r.jade.pct).toBe(0);
  });

  it('已勾条目计入「已获得」（不吃任何列表筛选）', () => {
    const r = summarizeGain(ITEMS, { d_card: Date.now() }, 'day');
    expect(r.jade.got).toBe(20);
    expect(r.jade.left).toBe(0);
    expect(r.jade.pct).toBe(100);
    /* 未勾的黑碎仍算在分母里 */
    expect(r.blackFrag.total).toBe(0.5);
    expect(r.blackFrag.got).toBe(0);
  });

  it('黑碎小数聚合无浮点噪声', () => {
    const extra = mk({ id: 'v_shop2', name: '另一黑蛋', cycle: 'version', gain: { blackFrag: 25 }, gainKind: ['blackDaruma'] });
    const r = summarizeGain([...ITEMS, extra], { v_shop: Date.now(), v_shop2: Date.now() }, 'month');
    expect(r.blackFrag.total).toBe(50);
    expect(r.blackFrag.got).toBe(50);
    expect(r.blackFrag.pct).toBe(100);
  });

  it('被一键日常覆盖的条目照样计入 —— coverMode 不参与计算', () => {
    const covered = { d_daruma: Date.now() };
    const r = summarizeGain(ITEMS, covered, 'day');
    /* d_daruma 在覆盖集合里（autoDaily），但收益必须照常计入 */
    expect(r.blackFrag.total).toBe(0.5);
    expect(r.blackFrag.got).toBe(0.5);
  });

  it('总量为 0 时百分比为 0（不产生 NaN）', () => {
    const r = summarizeGain([mk({ id: 'only_kind', gainKind: ['jade'] })], {}, 'day');
    expect(r.rows).toEqual([]);
    expect(r.jade).toEqual({ got: 0, total: 0, left: 0, pct: 0 });
  });
});

describe('summarizeRangeGain：按日期区间的收益（统计页改版 2026-09-15）', () => {
  it('同一条目多天各勾一次就累计多次（每日签到 7 天 = 7 份）', () => {
    const days = {
      '2026-09-13': ['d_card'],
      '2026-09-14': ['d_card', 'd_daruma'],
      '2026-09-15': ['d_card'],
    };
    const r = summarizeRangeGain(ITEMS, days, '2026-09-13', '2026-09-15');
    expect(r.jade).toBe(60); // 20 × 3 天
    expect(r.blackFrag).toBe(0.5); // 0.5 × 1 天
    expect(r.entries).toBe(4);
  });

  it('byDay 逐日明细，未记录的日子全 0（日历着色与单日卡片共用同一份）', () => {
    const r = summarizeRangeGain(ITEMS, { '2026-09-15': ['d_card'] }, '2026-09-14', '2026-09-15');
    expect(r.byDay['2026-09-14']).toEqual({ entries: 0, jade: 0, blackFrag: 0, blueTicket: 0 });
    expect(r.byDay['2026-09-15']).toMatchObject({ entries: 1, jade: 20 });
  });

  it('浮动收益条目计入条数、不计入数值（口径纪律不变）', () => {
    const r = summarizeRangeGain(ITEMS, { '2026-09-15': ['d_fengmo'] }, '2026-09-15', '2026-09-15');
    expect(r.entries).toBe(1);
    expect(r.jade).toBe(0);
    expect(r.blackFrag).toBe(0);
  });

  it('已删除 / 历史 id 计入条数但不计收益，不抛错', () => {
    const r = summarizeRangeGain(ITEMS, { '2026-09-15': ['gone_id', 'd_card'] }, '2026-09-15', '2026-09-15');
    expect(r.entries).toBe(2);
    expect(r.jade).toBe(20);
  });

  it('区间外 / 空日志 → 全 0', () => {
    const days = { '2026-09-15': ['d_card'] };
    expect(summarizeRangeGain(ITEMS, days, '2026-09-16', '2026-09-20').entries).toBe(0);
    expect(summarizeRangeGain(ITEMS, {}, '2026-09-15', '2026-09-15').jade).toBe(0);
  });

  it('小数累加无浮点噪声（0.5 + 0.5 = 1）', () => {
    const r = summarizeRangeGain(
      ITEMS,
      { '2026-09-14': ['d_daruma'], '2026-09-15': ['d_daruma'] },
      '2026-09-14',
      '2026-09-15',
    );
    expect(r.blackFrag).toBe(1);
    expect(r.byDay['2026-09-14'].blackFrag).toBe(0.5);
  });
});
