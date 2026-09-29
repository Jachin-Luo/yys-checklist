/**
 * 统计单测。重点锁定口径纪律①：只统计固定数值（浮动收益不进分子分母）。
 *
 * 2026-09-15：漏失明细（`missGroups`）与其用例已随「痛感只用于默认排序」删除。
 * 2026-09-29：周期进度口径（`periodItems` / `summarizeGain`）连同它的 8 条用例删除 ——
 * 它自 2026-09-15 起就没有页面消费，只剩自己的单测在断言。纪律 ②③（被覆盖项照样计入 /
 * 不受列表筛选影响）的用例随之消失：它们原本是靠"周期口径直接吃原始 `checked`"钉住的，
 * 而本文件剩下的区间收益数据源是**勾选日志**，本就不经过任何筛选 —— 没有可断言的通路了。
 * 三条纪律的字面表述仍在 `stats.ts` 文件头。
 */
import { describe, expect, it } from 'vitest';
import { summarizeRangeGain } from './stats';
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
  /* 每月：25 黑碎（1 整颗黑蛋） */
  mk({ id: 'm_shop', name: '秘卷屋礼盒', cycle: 'monthly', gain: { blackFrag: 25 }, gainKind: ['blackDaruma'], deadline: '2026-10-06' }),
];

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
