/**
 * 领域逻辑单测（设计文档 §9 S3 验收）：
 * 覆盖边界 —— 跨天 / 跨周 / 跨月、限时条目永不自动重置、无截止日、`isAutoHub` 恒第一。
 */
import { describe, expect, it } from 'vitest';
import { isArchived, mergeChecked, periodEndOf, periodStartOf, type ResetCtx } from './reset';
import { buildComparator, isVisible } from './sort';
import { effectiveView, mergeItems } from './merge';
import { appliesToday, deadlineBadge, formatRemain, parseTs, timeWindow } from './countdown';
import type { Item, ViewDefaults } from '../api/types';

const item = (over: Partial<Item>): Item => ({
  id: 'x', name: '测试条目', cycle: 'daily', origin: 'preset', ...over,
});

/* 周期收口为四类后只剩一个上下文字段（2026-09-28：版本 / 赛季锚点随周期合并退场） */
const CTX: ResetCtx = { resetHour: 0 };

describe('periodStartOf：4 档周期分派（§7）', () => {
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

  it('limited（含并入的版本 / 赛季活动）不自动重置：起点恒为 0', () => {
    expect(periodStartOf(item({ cycle: 'limited' }), new Date(), CTX)).toBe(0);
    expect(periodStartOf(item({ cycle: 'limited' }), new Date(2027, 0, 1), CTX)).toBe(0);
  });
});

describe('mergeChecked：时间戳比对归零 + 清理过期键', () => {
  const now = new Date(2026, 8, 10, 6, 0);
  it('周期内的保留，跨过起点的归零，已下线条目的键清理', () => {
    const items = [item({ id: 'd1' }), item({ id: 'm1', cycle: 'monthly' }), item({ id: 'gone' })];
    const out = mergeChecked(
      { d1: new Date(2026, 8, 10, 5, 30).getTime(), m1: new Date(2026, 8, 9, 10).getTime(), gone: 1 },
      items, now, CTX,
    );
    expect(out.d1).toBeTruthy();
    expect(out.m1).toBeTruthy();
    expect(out.gone).toBeUndefined();
  });

  it('daily：昨天 06:00 勾的，今天 06:00 读 → 归零', () => {
    const out = mergeChecked({ d1: new Date(2026, 8, 9, 6, 0).getTime() }, [item({ id: 'd1' })], now, CTX);
    expect(out.d1).toBeUndefined();
  });

  /* 2026-09-28 子组：子步骤 id 不在条目顶层，一度被当成"已下线条目"清掉 ——
     周期还没翻篇，进度就没了。存活集合必须按**步骤 id**建，周期按父条目算 */
  it('子步骤的进度不能被当成孤儿清掉（周期按父条目算）', () => {
    const demon = item({
      id: 'demon',
      children: [{ id: 'demon_1' }, { id: 'demon_2' }, { id: 'demon_3' }],
    });
    const at = new Date(2026, 8, 10, 5, 30).getTime();
    const out = mergeChecked({ demon_1: at, demon_2: at }, [demon], now, CTX);
    expect(out.demon_1).toBe(at);
    expect(out.demon_2).toBe(at);
  });

  it('已删除的子步骤照样清理（不留无限膨胀的孤儿键）', () => {
    const demon = item({ id: 'demon', children: [{ id: 'demon_1' }] });
    const out = mergeChecked({ demon_9: 1 }, [demon], now, CTX);
    expect(out.demon_9).toBeUndefined();
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

/* 2026-09-30：原先的「weightOf 痛感分派生」整组用例删除 —— 痛感分不再是排序依据，
   函数本身也随 `domain/weight.ts` 一起退场（用户："默认排序不用痛感算法了，就按照 db 的顺序来"）。
   默认排序改按**条目库顺序**，所以下面每个用例都要给 `dbIndex`（库内序号）。 */

describe('buildComparator：优先级 ① 一键入口 → ② 置顶 → ③ sortBy（D1）', () => {
  const hub = item({ id: 'hub', name: '一键日常', isAutoHub: true });
  const high = item({ id: 'lim1', name: '限时活动', cycle: 'limited', gain: { jade: 5 } });
  const low = item({ id: 'daily1', name: '每日', cycle: 'daily' });
  const pinned = item({ id: 'pin1', name: '置顶项', cycle: 'daily' });

  /** 库内序号：按给定顺序生成 —— 这个顺序就是"数据文件里的书写顺序" */
  const dbOf = (...list: Item[]) => new Map(list.map((it, i) => [it.id, i] as const));

  it('isAutoHub 恒第 0 位 —— 即使它在库里排最后', () => {
    const cmp = buildComparator({ sortBy: 'db', pinned: [], order: [], dbIndex: dbOf(high, low, hub) });
    const sorted = [high, low, hub].sort(cmp);
    expect(sorted[0].id).toBe('hub');
    expect(cmp(hub, high)).toBeLessThan(0);
  });

  it('☆ 置顶压过排序规则（其余按库顺序），但压不过一键入口', () => {
    const cmp = buildComparator({
      sortBy: 'db',
      pinned: ['pin1'],
      order: [],
      dbIndex: dbOf(low, high, pinned, hub),
    });
    const sorted = [low, high, pinned, hub].sort(cmp);
    /* 变量名 low / high 对应的 id 是 daily1 / lim1 —— 置顶之后按库内顺序（daily1 在前） */
    expect(sorted.map((i) => i.id)).toEqual(['hub', 'pin1', 'daily1', 'lim1']);
  });

  it('默认（db）：原样保持条目库顺序 —— 周期 / 收益 / 截止都不参与比较', () => {
    const first = item({ id: 'a', cycle: 'daily' });
    const second = item({ id: 'b', cycle: 'limited', gain: { jade: 99 }, deadline: '2026-09-30' });
    const third = item({ id: 'c', cycle: 'monthly' });
    const cmp = buildComparator({ sortBy: 'db', pinned: [], order: [], dbIndex: dbOf(first, second, third) });
    /* 故意打乱输入顺序：排完必须回到库里的 a → b → c（痛感分时代这里会是 c → b → a） */
    expect([third, first, second].sort(cmp).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(cmp(second, first)).toBeGreaterThan(0);
  });

  it('deadline 排序：有截止的按剩余天数升序，无截止一律沉底', () => {
    const none = item({ id: 'none', name: '无截止' });
    const far = item({ id: 'far', deadline: '2026-12-31' });
    const near = item({ id: 'near', deadline: '2026-09-12' });
    const cmp = buildComparator({
      sortBy: 'deadline',
      pinned: [],
      order: [],
      dbIndex: dbOf(none, far, near),
    });
    expect([none, far, near].sort(cmp).map((i) => i.id)).toEqual(['near', 'far', 'none']);
  });

  it('name 按字典序；cycle 按周期顺序（次键一律库内顺序）', () => {
    const b = item({ id: 'b', name: 'B项' });
    const a = item({ id: 'a', name: 'A项' });
    expect(
      [b, a]
        .sort(buildComparator({ sortBy: 'name', pinned: [], order: [], dbIndex: dbOf(b, a) }))
        .map((i) => i.id),
    ).toEqual(['a', 'b']);

    const d = item({ id: 'd', cycle: 'daily' });
    const o = item({ id: 'o', cycle: 'limited' });
    const byCycle = [d, o].sort(
      buildComparator({ sortBy: 'cycle', pinned: [], order: [], dbIndex: dbOf(d, o) }),
    );
    expect(byCycle[0].cycle).toBe('limited');
  });

  it('custom：按 order 全序，不在 order 里的新条目按库内顺序排在后面', () => {
    const o = item({ id: 'o' });
    const d = item({ id: 'd' });
    const fresh = item({ id: 'fresh', cycle: 'daily', name: '新条目' });
    const cmp = buildComparator({
      sortBy: 'custom',
      pinned: [],
      order: ['d', 'o'],
      dbIndex: dbOf(fresh, o, d),
    });
    expect([fresh, o, d].sort(cmp).map((i) => i.id)).toEqual(['d', 'o', 'fresh']);
  });
});

describe('isVisible：days（D4）', () => {
  const base = { today: 4 };
  const daily = item({ id: 'd', gainKind: ['jade'] });

  /* 2026-09-15：原先的「minWeight 门槛」用例随该门槛删除 —— 痛感只作默认排序键，不再是筛选维度。
     2026-09-24：「hideDone / keepDone」用例随那两个字段一起删除 —— 它的唯一作用是
     "按勾选状态把条目从列表里抽走"，正是"分组被静默拆散"的成因之一，删掉后没有可断言的行为。
     2026-09-28：「showKinds / 奖励类型筛选」用例随该字段一并删除 —— 它是 `SHOW_KIND_FILTER`
     开关拴着的最后一段代码，删掉后这里不再有"按类型筛"的行为可断言（剩 `days` 一条）。 */
  it('一键日常入口豁免全部筛选（days 不作用在它身上）', () => {
    const hub = item({ id: 'hub', isAutoHub: true });
    expect(isVisible(hub, { ...base, today: 1 })).toBe(true);
  });

  it('已勾条目照常可见 —— 可见性不再吃勾选状态（"沉下去但仍在"是本项目的既定表达）', () => {
    /* 这条钉住 2026-09-24 的删除动作本身：函数签名里已经没有那条通路了 */
    expect(isVisible(daily, base)).toBe(true);
  });

  it('days 星期过滤：今天不开的不显示', () => {
    const wed = item({ id: 'w', days: [3] });
    expect(isVisible(wed, { ...base, today: 4 })).toBe(false);
    expect(isVisible(wed, { ...base, today: 3 })).toBe(true);
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

  it('自建条目里已删除的历史周期 `once` 归一为 `limited`', () => {
    /* 旧版录入下拉里有「一次性」，用户的自建条目可能仍是这个值 ——
       类型上已不合法，分片字节里却真实存在，所以这里绕过 TS 造一条 */
    const legacy = { ...item({ id: 'c1' }), cycle: 'once' } as unknown as Item;
    const out = mergeItems(seed, {
      profileId: 'p', hidden: [], order: [], custom: [legacy], updatedAt: '',
    });
    expect(out.find((i) => i.id === 'c1')?.cycle).toBe('limited');
    /* 其余周期原样放行 */
    const untouched = mergeItems(seed, {
      profileId: 'p', hidden: [], order: [], custom: [item({ id: 'c2', cycle: 'monthly' })], updatedAt: '',
    });
    expect(untouched.find((i) => i.id === 'c2')?.cycle).toBe('monthly');
  });

  it('预设改写（`patches`）按 id 盖在种子上；没被改写的条目引用不变', () => {
    const out = mergeItems(seed, {
      profileId: 'p', custom: [], hidden: [], order: [], updatedAt: '',
      patches: { p2: { name: '改过的名字', note: null } },
    });
    const p2 = out.find((i) => i.id === 'p2');
    expect(p2?.name).toBe('改过的名字');
    expect(p2?.origin).toBe('preset'); // 改写不改来源
    /* 没被改写的条目原样返回（引用相等）—— 上游有按引用做的 memo */
    expect(out.find((i) => i.id === 'p1')).toBe(seed[0]);
    expect(out.find((i) => i.id === 'p3')).toBe(seed[2]);
  });

  it('effectiveView：账号偏好缺字段时回落默认值', () => {
    const defaults: ViewDefaults = { sortBy: 'db', minWeight: 0, pinned: [] };
    const v = effectiveView(defaults, { profileId: 'p', sortBy: 'name' });
    expect(v.sortBy).toBe('name');
    expect(v.minWeight).toBe(0);
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

  it('formatRemain：天 + 小时；不足 1 小时不显示 0', () => {
    const H = 3600000;
    /* floor 口径：还剩 5 小时 23 分说「剩 5 小时」，不夸大 —— 与 deadlineBadge 的 ceil 刻意不同 */
    expect(formatRemain(5 * H + 23 * 60000)).toBe('剩 5 小时');
    expect(formatRemain(2 * 24 * H + 5 * H)).toBe('剩 2 天 5 小时');
    /* 小时为 0 时省掉那一段 */
    expect(formatRemain(2 * 24 * H)).toBe('剩 2 天');
    /* 不足 1 小时不能说「剩 0 小时」（读起来像已经结束） */
    expect(formatRemain(30 * 60000)).toBe('不足 1 小时');
    expect(formatRemain(0)).toBe('即将刷新');
    expect(formatRemain(-1000)).toBe('即将刷新');
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

describe('periodEndOf：周期结束点（今日 / 本周 / 本月倒计时）', () => {
  const ctx: ResetCtx = { resetHour: 0 };

  it('日 / 周 / 月各取下一次重置时刻', () => {
    /* 2026-09-20 是周日 */
    const sundayNoon = new Date(2026, 8, 20, 12, 0);
    /* 今日 → 明天 0 点 */
    expect(periodEndOf('daily', sundayNoon, ctx)).toBe(new Date(2026, 8, 21).getTime());
    /* 本周 → 下周一 0 点（周日是一周最后一天，所以同样是明天） */
    expect(periodEndOf('weekly', sundayNoon, ctx)).toBe(new Date(2026, 8, 21).getTime());
    /* 本月 → 下月 1 日 0 点（跨月由 Date 自己处理） */
    expect(periodEndOf('monthly', sundayNoon, ctx)).toBe(new Date(2026, 9, 1).getTime());
  });

  it('resetHour 非 0：周期起点落在"昨天"时，终点落在今天', () => {
    /* 4 点刷新、现在 2:00 → 当前周期起点是昨天 4:00，结束在**今天** 4:00（即 2 小时后） */
    const ctx4: ResetCtx = { resetHour: 4 };
    expect(periodEndOf('daily', new Date(2026, 8, 20, 2, 0), ctx4)).toBe(
      new Date(2026, 8, 20, 4, 0).getTime(),
    );
  });

  it('不自动重置的周期返回 null（调用点据此不渲染倒计时）', () => {
    expect(periodEndOf('limited', new Date(2026, 8, 20), ctx)).toBeNull();
  });

  it('倒计时归零的那一刻就是重置的那一刻（两个函数必须闭合）', () => {
    const now = new Date(2026, 8, 20, 12, 0);
    for (const cycle of ['daily', 'weekly', 'monthly'] as const) {
      const end = periodEndOf(cycle, now, ctx);
      expect(end).not.toBeNull();
      /* 终点前一毫秒仍属于当前周期，终点那一刻已属于下一周期 —— 这是"倒计时与重置同源"的形式化表达 */
      expect(periodStartOf(item({ cycle }), new Date(end! - 1), ctx)).toBeLessThan(end!);
      expect(periodStartOf(item({ cycle }), new Date(end!), ctx)).toBe(end);
    }
  });
});
