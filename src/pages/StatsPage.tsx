import { useMemo, useState } from 'react';
import { buildMonthGrid, monthTitle, WEEKDAY_HEAD, type CalendarCell } from '../domain/calendar';
import { dayCount, dayKey, keyToTs, shiftDayKey } from '../domain/checkLog';
import { summarizeRangeGain } from '../domain/stats';
import { useCheckStore } from '../stores/check';
import { useItemStore } from '../stores/items';

/** 时间范围：三个快捷区间 + 单日（点日历某天选中） */
type RangeSel =
  | { kind: 'recent'; days: 7 | 30 }
  | { kind: 'month' }
  | { kind: 'day'; key: string };

const WEEKDAY_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

/**
 * 深浅着色档位（类 GitHub 贡献图）：0 无记录；1–4 按**当月最大值**相对分档。
 * 2026-09-23 换肤：色相由品牌紫改为**朱红**——它是本页唯一的"热度"通道，
 * 用朱红而不是金，是为了与页面上其它金色描边区分开（金是结构色，朱红才是强调色）。
 */
const LEVEL_CLASS = ['', 'bg-crimson/15', 'bg-crimson/30', 'bg-crimson/50', 'bg-crimson/75'] as const;

/** `2026-09-15` → `9月15日` */
function mdLabel(key: string): string {
  const ts = keyToTs(key);
  if (ts === null) return key;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** `2026-09-15` → `周三` */
function wdLabel(key: string): string {
  const ts = keyToTs(key);
  if (ts === null) return '';
  return WEEKDAY_CN[(new Date(ts).getDay() + 6) % 7];
}

function DayCell({
  cell,
  count,
  level,
  today,
  selected,
  onPick,
}: {
  cell: CalendarCell;
  count: number;
  level: number;
  today: boolean;
  selected: boolean;
  onPick: (key: string) => void;
}) {
  /* 深档用「纸色」字：明版是米白、暗版是墨黑 —— 同一个类在两版上都能压住朱红底 */
  const strong = level >= 3;
  const tone = strong
    ? 'text-surface-2'
    : cell.inMonth
      ? count > 0
        ? 'text-ink'
        : 'text-ink-3'
      : 'text-ink-4';

  return (
    <button
      type="button"
      onClick={() => onPick(cell.key)}
      aria-pressed={selected}
      title={`${mdLabel(cell.key)} ${wdLabel(cell.key)} · 完成 ${count} 条`}
      className={`flex h-8 cursor-pointer flex-col items-center justify-center rounded-sm font-mono text-sm transition-colors duration-120 ${LEVEL_CLASS[level]} ${tone} ${
        selected ? 'ring-2 ring-gold-hi' : today ? 'ring-1 ring-line' : ''
      } ${cell.inMonth ? '' : 'opacity-50'}`}
    >
      {cell.day}
    </button>
  );
}

/**
 * 统计页（设计文档 §9 S4b-2 / Q23）。
 *
 * **2026-09-15 整版重做**：原「本日 / 本周 / 本月 三条收益进度条」被换成
 * 「月度日历 + 时间区间收益」——
 *   - 上方日历按**当天完成条数**深浅着色（类贡献图），点某天即把下方区间切成那一天；
 *   - 下方是三个快捷区间（近 7 天 / 近 30 天 / 本月）与三币种累计值。
 *
 * 为什么能回答"近 7 天拿到多少"：勾选日志（`CheckLog`）按日期分桶留存历史，
 * 而 `checked` 每条只保留最近一次勾选时间戳（周期重置靠它比对），回答不了区间问题。
 * 区间收益走 `domain/stats.summarizeRangeGain`，口径纪律不变：只统计固定数值。
 *
 * 日历着色与区间统计是**两套范围**（日历永远看整月，区间看选中范围），
 * 所以着色直接用 `dayCount(log, key)`，不依赖选中区间 —— 切区间时日历颜色不该变。
 */
export default function StatsPage() {
  const items = useItemStore((s) => s.items);
  const log = useCheckStore((s) => s.log);
  /* 进入页面时固定"今天"：今天标记与快捷区间都以它为基准。
     跨夜需重新进入（统计页不做每分钟重估，成本与收益不匹配） */
  const [now] = useState(() => new Date());
  const [sel, setSel] = useState<RangeSel>({ kind: 'recent', days: 7 });

  const todayKey = dayKey(now);
  const grid = useMemo(() => buildMonthGrid(now), [now]);

  const { fromKey, toKey } = useMemo(() => {
    if (sel.kind === 'day') return { fromKey: sel.key, toKey: sel.key };
    /* 「本月」取到**今天**为止（而不是月末）：未来那几天本来就没有记录，
       把它们的空白算进来只会让人以为"少做了" */
    if (sel.kind === 'month') return { fromKey: `${grid.monthKey}-01`, toKey: todayKey };
    return { fromKey: shiftDayKey(todayKey, -(sel.days - 1)), toKey: todayKey };
  }, [sel, grid.monthKey, todayKey]);

  const range = useMemo(
    () => summarizeRangeGain(items, log, fromKey, toKey),
    [items, log, fromKey, toKey],
  );

  /* 日历着色基准：当月单日最大完成数（相对分档，类贡献图） */
  const monthMax = useMemo(() => {
    let max = 0;
    for (const week of grid.weeks) for (const cell of week) max = Math.max(max, dayCount(log, cell.key));
    return max;
  }, [grid, log]);

  const levelOf = (n: number): number =>
    n <= 0 || monthMax <= 0 ? 0 : Math.min(4, Math.ceil((n / monthMax) * 4));

  /* 点已选中的那一天 → 回到默认的近 7 天（与"再点一次取消选择"一致） */
  const pickDay = (key: string) =>
    setSel((cur) => (cur.kind === 'day' && cur.key === key ? { kind: 'recent', days: 7 } : { kind: 'day', key }));

  const rangeText =
    sel.kind === 'day'
      ? `${mdLabel(fromKey)} ${wdLabel(fromKey)}`
      : `${mdLabel(fromKey)} - ${mdLabel(toKey)}`;

  const rangeBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`cursor-pointer px-3 py-1.5 text-sm transition-colors duration-120 ${
        active ? 'bg-gold-soft font-medium text-gold-hi' : 'bg-surface text-ink-2 hover:bg-surface-3'
      }`}
    >
      {label}
    </button>
  );

  return (
    /* `mx-auto` 居中：本页宽度上限 768，而桌面内容容器上限 1024 —— 不居中时右侧会空出约 256px，
       看起来像"内容没写完"（2026-09-14 用户反馈） */
    <div className="mx-auto max-w-3xl px-3.5 py-3 pb-10">
      <div className="rounded-md border border-line-soft bg-surface px-3 py-3 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-serif text-xl tracking-card text-ink">{monthTitle(now)}</p>
          <span className="text-sm text-ink-3">颜色越深 = 当天勾选越多 · 点某天可只看那天</span>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-2xs tracking-label text-ink-3">
          {WEEKDAY_HEAD.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.weeks.flat().map((cell) => (
            <DayCell
              key={cell.key}
              cell={cell}
              count={dayCount(log, cell.key)}
              level={levelOf(dayCount(log, cell.key))}
              today={cell.key === todayKey}
              selected={sel.kind === 'day' && sel.key === cell.key}
              onPick={pickDay}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex w-fit overflow-hidden rounded-sm border border-line">
          {rangeBtn('近 7 天', sel.kind === 'recent' && sel.days === 7, () => setSel({ kind: 'recent', days: 7 }))}
          {rangeBtn('近 30 天', sel.kind === 'recent' && sel.days === 30, () => setSel({ kind: 'recent', days: 30 }))}
          {rangeBtn('本月', sel.kind === 'month', () => setSel({ kind: 'month' }))}
        </div>
        <span className="text-sm text-ink-2">
          {rangeText} · 完成 <b className="font-mono font-medium text-ink">{range.entries}</b> 条
        </span>
        {sel.kind === 'day' ? (
          <button
            type="button"
            onClick={() => setSel({ kind: 'recent', days: 7 })}
            className="cursor-pointer rounded-sm border border-line px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-line hover:bg-surface"
          >
            返回近 7 天
          </button>
        ) : null}
      </div>

      {/* `md` 而不是 `sm`：统计页在移动壳里也用同一份代码，而 `sm`(640px) 在手机上也会命中 ——
          640–767px（横屏手机）会莫名变成三列，与"窄屏一律单列"的全局口径打架 */}
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="relative rounded-sm border border-line-soft bg-surface px-3 py-3 shadow-card">
          <i className="absolute -left-px -top-px h-1.5 w-1.5 border-l border-t border-line" />
          <p className="text-sm text-ink-3">勾玉</p>
          <p className="mt-1 font-mono text-2xl text-jade">{range.jade}</p>
          <p className="mt-0.5 text-sm text-ink-3">固定奖励</p>
        </div>
        <div className="relative rounded-sm border border-line-soft bg-surface px-3 py-3 shadow-card">
          <i className="absolute -left-px -top-px h-1.5 w-1.5 border-l border-t border-line" />
          <p className="text-sm text-ink-3">黑碎</p>
          <p className="mt-1 font-mono text-2xl text-frag">{range.blackFrag}</p>
          <p className="mt-0.5 text-sm text-ink-3">1 黑蛋 = 25 片</p>
        </div>
        <div className="relative rounded-sm border border-line-soft bg-surface px-3 py-3 shadow-card">
          <i className="absolute -left-px -top-px h-1.5 w-1.5 border-l border-t border-line" />
          <p className="text-sm text-ink-3">蓝票</p>
          <p className="mt-1 font-mono text-2xl text-ticket">{range.blueTicket}</p>
          <p className="mt-0.5 text-sm text-ink-3">神秘的符咒</p>
        </div>
      </div>

      {range.entries === 0 ? (
        <p className="mt-3 rounded-md bg-surface-3 px-3 py-2.5 text-sm leading-relaxed text-ink-3">
          这段时间还没有勾选记录。在清单里勾一条，当天就会在日历上留下颜色，收益也按天累计。
        </p>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-ink-3">
        只统计固定数值（勾玉 / 黑碎 / 蓝票）：数量浮动的收益不折算、不估算 ——
        把「看运气掉几个」当保底算，比不算更误导。同一条目多天各完成一次就累计多次
        （每日签到 7 天就是 7 份）；日历颜色按当天的勾选条数分档，与收益数值无关。
      </p>
    </div>
  );
}
