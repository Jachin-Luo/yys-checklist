/**
 * 领域逻辑单测（设计文档 §9 S3 验收）：
 * 覆盖边界 —— 跨天 / 跨周 / 跨月 / 跨版本 / 跨赛季、无截止日、`isAutoHub` 恒第一。
 */
import { describe, expect, it } from 'vitest';
import { isArchived, mergeChecked, periodStartOf, type ResetCtx } from './reset';
import { buildComparator, isVisible } from './sort';
import { weightOf } from './weight';
import { effectiveView, mergeItems } from './merge';
import { appliesToday, deadlineBadge, parseTs, timeWindow } from './countdown';
import type { Item, ViewDefaults } from '../api/types';

const item = (over: Partial<Item>): Item => ({
  id: 'x', name: '测试条目', cycle: 'daily', origin: 'preset', ...over,
});

const CTX: ResetCtx = {
  resetHour: 0,
  periods: {
    version: { key: '2026.09.09', startAt: '2026-09-09T09:00' },
    season: { key: '寻龙逐英', startAt: '2026-09-09T09:00' },
  },
};

describe('periodStartOf：7 档周期分派（§7）', () => {
  it('daily：0 点为界 —— 当天任意时刻归当天 0 点，前一天 23:59 归前一天 0 点（跨天）', () => {
    const it = item({});
    expect(periodStartOf(it, new Date(2026, 8, 10, 6, 0), CTX)).toBe(new Date(2026, 8, 10, 0, 0).getTime());
    expect(periodStartOf(it, new Date(2026, 8, 9, 23, 59), CTX)).toBe(new Date(2026, 8, 9, 0, 0).getTime());
  });

  it('weekly：周三与周日都归到本周一 0 点（跨周）', () => {
    const it = item({ cycle: 'weekly' });
    const monday = new Date(2026, 8, 7, 0, 0).getTime();
    expect(periodStartOf(it, new Date(2026, 8, 9, 12, 0), CTX)).toBe(monday);
    expect(periodStartOf(it, new Date(2026, 8, 13, 12, 0), CTX)).toBe(monday);
  });

  it('monthly：跨月以 0 点为界 —— 8/31 23:59 仍属上月，9/1 00:00 进入本月', () => {
    const it = item({ cycle: 'monthly' });
    expect(periodStartOf(it, new Date(2026, 8, 15, 6, 0), CTX)).toBe(new Date(2026, 8, 1, 0, 0).getTime());
    expect(periodStartOf(it, new Date(2026, 7, 31, 23, 59), CTX)).toBe(new Date(2026, 7, 1, 0, 0).getTime());
    expect(periodStartOf(it, new Date(2026, 8, 1, 0, 0), CTX)).toBe(new Date(2026, 8, 1, 0, 0).getTime());
  });

  it('version / season：按 meta.periods 锚点，不套每日 0 点（D2）', () => {
    const anchor = new Date(2026, 8, 9, 9, 0).getTime();
    expect(periodStartOf(item({ cycle: 'version' }), new Date(2026, 8, 10, 6, 0), CTX)).toBe(anchor);
    expect(periodStartOf(item({ cycle: 'season' }), new Date(2026, 8, 10, 3, 0), CTX)).toBe(anchor);
  });

  it('once / limited 不自动重置；锚点缺失时退化为不重置', () => {
    expect(periodStartOf(item({ cycle: 'once' }), new Date(), CTX)).toBe(0);
    expect(periodStartOf(item({ cycle: 'limited' }), new Date(), CTX)).toBe(0);
    expect(periodStartOf(item({ cycle: 'version' }), new Date(), { resetHour: 0, periods: {} })).toBe(0);
  });
});

describe('mergeChecked：时间戳比对归零 + 清理过期键', () => {
  const now = new Date(2026, 8, 10, 6, 0);
  it('周期内的保留，跨过起点的归零，已下线条目的键清理', () => {
    const items = [item({ id: 'd1' }), item({ id: 'v1', cycle: 'version' }), item({ id: 'gone' })];
    const out = mergeChecked(
      { d1: new Date(2026, 8, 10, 5, 30).getTime(), v1: new Date(2026, 8, 9, 10).getTime(), gone: 1 },
      items, now, CTX,
    );
    expect(out.d1).toBeTruthy();
    expect(out.v1).toBeTruthy();
    expect(out.gone).toBeUndefined();
  });

  it('daily：昨天 06:00 勾的，今天 06:00 读 → 归零', () => {
    const out = mergeChecked({ d1: new Date(2026, 8, 9, 6, 0).getTime() }, [item({ id: 'd1' })], now, CTX);
    expect(out.d1).toBeUndefined();
  });
});

describe('isArchived：until 当天仍显示，次日归档', () => {
  const limited = item({ cycle: 'limited', until: '2026-10-07' });
  it('边界', () => {
    expect(isArchived(limited, new Date(2026, 9, 7, 12, 0))).toBe(false);
    expect(isArchived(limited, new Date(2026, 9, 8, 0, 0))).toBe(true);
    expect(isArchived(item({}), new Date())).toBe(false);
  });
});

describe('weightOf：痛感分派生（取代主观价值档）', () => {
  it('周期权重 + 稀缺性 + 固定收益', () => {
    expect(weightOf(item({ cycle: 'daily' }))).toBe(10);
    expect(weightOf(item({ cycle: 'weekly' }))).toBe(20);
    expect(weightOf(item({ cycle: 'monthly' }))).toBe(30);
    expect(weightOf(item({ cycle: 'daily', deadline: '2026-10-06' }))).toBe(25);
    expect(weightOf(item({ cycle: 'monthly', gain: { jade: 20 } }))).toBe(40);
    expect(weightOf(item({ cycle: 'once', until: '2026-10-07', gain: { jade: 20 } }))).toBe(65);
  });

  it('isAutoHub 虽只有 10 分，但不靠它排序（由 compare 特判）', () => {
    const hub = item({ id: 'hub', isAutoHub: true });
    expect(weightOf(hub)).toBe(10);
  });
});

describe('buildComparator：优先级 ① 一键入口 → ② 置顶 → ③ sortBy（D1）', () => {
  const hub = item({ id: 'hub', name: '一键日常', isAutoHub: true });
  const high = item({ id: 'once1', name: '一次性', cycle: 'once', gain: { jade: 5 } });
  const low = item({ id: 'daily1', name: '每日', cycle: 'daily' });
  const pinned = item({ id: 'pin1', name: '置顶项', cycle: 'daily' });

  it('isAutoHub 恒第 0 位，即使痛感分最低', () => {
    const cmp = buildComparator({ sortBy: 'weight', pinned: [], order: [] });
    const sorted = [high, low, hub].sort(cmp);
    expect(sorted[0].id).toBe('hub');
    expect(cmp(hub, high)).toBeLessThan(0);
  });

  it('☆ 置顶压过排序规则，但压不过一键入口', () => {
    const cmp = buildComparator({ sortBy: 'weight', pinned: ['pin1'], order: [] });
    const sorted = [low, high, pinned, hub].sort(cmp);
    expect(sorted.map((i) => i.id)).toEqual(['hub', 'pin1', 'once1', 'daily1']);
  });

  it('weight 降序；同分时 deadline 近的靠前', () => {
    const cmp = buildComparator({ sortBy: 'weight', pinned: [], order: [] });
    const a = item({ id: 'a', cycle: 'daily', deadline: '2026-09-20' });
    const b = item({ id: 'b', cycle: 'daily', deadline: '2026-09-12' });
    expect([a, b].sort(cmp)[0].id).toBe('b');
  });

  it('deadline 排序：有截止的按剩余天数升序，无截止一律沉底', () => {
    const cmp = buildComparator({ sortBy: 'deadline', pinned: [], order: [] });
    const none = item({ id: 'none', name: '无截止' });
    const far = item({ id: 'far', deadline: '2026-12-31' });
    const near = item({ id: 'near', deadline: '2026-09-12' });
    expect([none, far, near].sort(cmp).map((i) => i.id)).toEqual(['near', 'far', 'none']);
  });

  it('name 按字典序；cycle 按周期顺序', () => {
    expect([item({ id: 'b', name: 'B项' }), item({ id: 'a', name: 'A项' })]
      .sort(buildComparator({ sortBy: 'name', pinned: [], order: [] })).map((i) => i.id)).toEqual(['a', 'b']);
    const byCycle = [item({ id: 'd', cycle: 'daily' }), item({ id: 'o', cycle: 'once' })]
      .sort(buildComparator({ sortBy: 'cycle', pinned: [], order: [] }));
    expect(byCycle[0].cycle).toBe('once');
  });

  it('custom：按 order 全序，新条目（不在 order 里）沉底', () => {
    const cmp = buildComparator({ sortBy: 'custom', pinned: [], order: ['d', 'o'] });
    const fresh = item({ id: 'fresh', cycle: 'once', name: '新条目' });
    const sorted = [fresh, item({ id: 'o' }), item({ id: 'd' })].sort(cmp);
    expect(sorted.map((i) => i.id)).toEqual(['d', 'o', 'fresh']);
  });
});

describe('isVisible：showKinds / hideDone / days（D4）', () => {
  const base = { showKinds: [], hideDone: false, today: 4 };
  const daily = item({ id: 'd', gainKind: ['jade'] });

  /* 2026-09-15：原先的「minWeight 门槛」用例随该门槛删除 —— 痛感只作默认排序键，不再是筛选维度 */
  it('一键日常入口豁免全部筛选（showKinds / hideDone / days 都不作用在它身上）', () => {
    const hub = item({ id: 'hub', isAutoHub: true });
    expect(isVisible(hub, 123, { ...base, showKinds: ['soul'], hideDone: true, today: 1 })).toBe(true);
  });

  it('showKinds 空数组 = 全部显示；非空则取交集', () => {
    expect(isVisible(daily, undefined, base)).toBe(true);
    expect(isVisible(daily, undefined, { ...base, showKinds: ['soul'] })).toBe(false);
    expect(isVisible(daily, undefined, { ...base, showKinds: ['jade'] })).toBe(true);
  });

  it('hideDone 生效；keepDone 豁免（统计页用，否则"已获得"归零）', () => {
    expect(isVisible(daily, 123, { ...base, hideDone: true })).toBe(false);
    expect(isVisible(daily, 123, { ...base, hideDone: true, keepDone: true })).toBe(true);
  });

  it('days 星期过滤：今天不开的不显示', () => {
    const wed = item({ id: 'w', days: [3] });
    expect(isVisible(wed, undefined, { ...base, today: 4 })).toBe(false);
    expect(isVisible(wed, undefined, { ...base, today: 3 })).toBe(true);
  });
});

describe('mergeItems / effectiveView：种子 + 覆盖层 → 有效数据（§2）', () => {
  const seed = [item({ id: 'p1' }), item({ id: 'p2' }), item({ id: 'p3' })];

  it('hidden 过滤预设，custom 追加且 origin 强制为 custom', () => {
    const out = mergeItems(seed, {
      profileId: 'p', hidden: ['p2'], order: [],
      custom: [item({ id: 'c1', origin: 'preset' })], updatedAt: '',
    });
    expect(out.map((i) => i.id)).toEqual(['p1', 'p3', 'c1']);
    expect(out.find((i) => i.id === 'c1')?.origin).toBe('custom');
  });

  it('effectiveView：档案偏好缺字段时回落默认值', () => {
    const defaults: ViewDefaults = { sortBy: 'weight', showKinds: [], minWeight: 0, hideDone: false, pinned: [] };
    const v = effectiveView(defaults, { profileId: 'p', sortBy: 'name', showKinds: ['jade'] });
    expect(v.sortBy).toBe('name');
    expect(v.showKinds).toEqual(['jade']);
    expect(v.minWeight).toBe(0);
    expect(v.hideDone).toBe(false);
    expect(v.coverMode).toBe('dim');
  });
});

describe('countdown：倒计时与时间窗', () => {
  it('parseTs：纯日期 = 当天 23:59:59；带钟点按字面解析；T 分隔同样支持', () => {
    expect(parseTs('2026-10-07')).toBe(new Date(2026, 9, 7, 23, 59, 59).getTime());
    expect(parseTs('2026-10-06 23:59')).toBe(new Date(2026, 9, 6, 23, 59, 0).getTime());
    expect(parseTs('2026-09-09T09:00')).toBe(new Date(2026, 8, 9, 9, 0, 0).getTime());
    expect(parseTs(undefined)).toBeNull();
  });

  it('deadlineBadge：≤3 天红、≤7 天橙；无截止按 start 提示"开启"', () => {
    const now = new Date(2026, 9, 3, 12, 0);
    expect(deadlineBadge(item({ deadline: '2026-10-05 23:59' }), now).level).toBe('hot');
    expect(deadlineBadge(item({ deadline: '2026-10-08 23:59' }), now).level).toBe('warn');
    expect(deadlineBadge(item({ deadline: '2026-10-30' }), now).level).toBe('normal');
    expect(deadlineBadge(item({ start: '2026-10-20' }), now).text).toContain('开启');
    expect(deadlineBadge(item({}), now).text).toBe('待定');
  });

  it('deadlineBadge：不足一天改按小时显示', () => {
    const now = new Date(2026, 9, 3, 12, 0);
    /* 还剩 11 小时 59 分 → 向上取整为 12 小时；不再是 daysLeft 的「剩 1 天」 */
    const hours = deadlineBadge(item({ deadline: '2026-10-03 23:59' }), now);
    expect(hours.text).toContain('剩 12 小时');
    expect(hours.hours).toBe(12);
    /* `days` 仍是粗粒度口径：两个字段并存，颜色分级（≤3 天红）继续走它 */
    expect(hours.days).toBe(1);
    expect(hours.level).toBe('hot');

    /* 正好 24 小时：仍走「天」，与 ceil 一致 */
    expect(deadlineBadge(item({ deadline: '2026-10-04 12:00' }), now).text).toContain('剩 1 天');

    /* 不足 1 小时也至少是 1，不能出现「剩 0 小时」 */
    const lastHour = deadlineBadge(item({ deadline: '2026-10-03 12:30' }), now);
    expect(lastHour.text).toContain('剩 1 小时');
    expect(lastHour.hours).toBe(1);

    /* 已过：时间差 ≤ 0 → 「已结束」，此时 hours 不参与 */
    const over = deadlineBadge(item({ deadline: '2026-10-03 11:00' }), now);
    expect(over.text).toContain('已结束');
    expect(over.hours).toBeNull();
  });

  it('timeWindow：未开始 / 进行中 / 已结束', () => {
    const it = item({ time: '17:00', timeEnd: '23:00' });
    expect(timeWindow(it, new Date(2026, 8, 10, 16, 0)).state).toBe('wait');
    expect(timeWindow(it, new Date(2026, 8, 10, 18, 0)).state).toBe('open');
    expect(timeWindow(it, new Date(2026, 8, 10, 23, 30)).state).toBe('over');
    expect(timeWindow(item({}), new Date()).state).toBe('none');
  });

  it('appliesToday：days 缺省为每天', () => {
    expect(appliesToday(item({}), new Date(2026, 8, 10))).toBe(true);
    expect(appliesToday(item({ days: [3, 6] }), new Date(2026, 8, 9))).toBe(true);
    expect(appliesToday(item({ days: [3, 6] }), new Date(2026, 8, 10))).toBe(false);
  });
});
