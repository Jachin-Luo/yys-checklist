import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import {
  endLabelOf,
  endPointOf,
  hmToDate,
  MAX_NURTURE_DELAY,
  MAX_NURTURE_HOURS,
  nextPendingPoint,
  normalizeHM,
  nowHM,
  pointCountOf,
  pointStats,
  recordPoints,
  sortNurture,
  type NurturePoint,
  type NurtureRecord,
} from '../../domain/nurture';
import { useNurtureStore } from '../../stores/nurture';
import { useUiStore } from '../../stores/ui';

/**
 * 结界寄养（S6）。
 *
 * 规则：每次 6 小时，一天理论 4 次。填上卡时间 → 自动排出往后每 6h 的收/续点。
 *
 * ## 点模型（2026-09-15 重构，规则见 `domain/nurture` 文件头）
 *
 * 点列表由**上卡点打头**（它也是任务的起点，之前只存在 `base` 里、界面上看不到），
 * 之后是收/续点。每个收/续点都能**单独**记完成，记完之后只有它**之后**的点按
 * 实际时间 + 6h 递推 —— 早先那版「一个按钮把整条任务重推一遍」会让人以为任务被初始化了。
 *
 * ## 两个列表是刻意的
 *
 * 添加时先问「立即开始 / 仅存计划」：任务才记完成状态，计划纯查看（虚线、不可点），
 * 决定开刷时点「开始」转正。用户常常只是"打算这个点寄"，不想一存就被判成未到。
 *
 * 数据落在**档案级**分片（`yys:plans:{profileId}`，2026-09-16 由设备级升格）：
 * 换号会切到该号自己的那份，且随备份一起走 —— 见 `stores/nurture.ts` 的说明。
 *
 * 布局注记（2026-09-16）：任务行是「上卡信息 / 点 chips / 操作条 / 删除」四块横向排列，
 * 移动端靠 `flex-wrap` 折行。**点 chips 的容器必须给最小宽度**，否则它会被压到 0 宽、
 * 里面的 chip 溢出到操作条上（详见该行的注释）。
 *
 * 2026-09-20：表单**不再让用户选推点数**，改为填「结界卡持续时间」（小时），
 * 点数由 `pointCountOf(hours)` 派生（22h → 3 个收/续点）。同时显示**只读的结束时间**
 * = 上卡 + 持续时间 —— 这个值由前两者决定，不给单独编辑入口。
 * 理由是"推几个点"是寄养机制的内部换算，而用户手里的事实是"这张卡能撑多久"。
 */

/** 点 chip 的语气：已完成 / 过期未完成（该收了）/ 未到；计划态一律虚线只读 */
function toneOf(point: NurturePoint, selected: boolean, planned: boolean): string {
  if (planned) return 'border border-dashed border-line text-ink-3';
  if (selected) return 'border border-brand bg-brand-soft text-brand';
  if (point.doneAt !== undefined) return 'bg-success/10 text-success-deep';
  if (point.past) return 'bg-warn-soft text-warn';
  return 'bg-surface-3 text-ink-2';
}

function PointChips({
  record,
  now,
  selected,
  onSelect,
}: {
  record: NurtureRecord;
  now: Date;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const points = recordPoints(record, now);
  const endPoint = endPointOf(record, now);
  const planned = !record.started;

  return (
    <div className="flex flex-wrap gap-1">
      {points.map((p) => {
        const tone = toneOf(p, selected === p.index, planned);
        const body = (
          <>
            <span className="flex items-center gap-0.5">
              {p.doneAt !== undefined ? <Check size={10} strokeWidth={3} /> : null}
              {p.hm}
            </span>
            <i className="text-xs not-italic opacity-80">{p.index === 0 ? '上卡' : p.dayLabel}</i>
          </>
        );

        /* 上卡点是任务起点、由 `base` 决定，不接受"记完成" —— 渲染成只读 chip */
        if (planned || p.index === 0) {
          return (
            <span key={p.index} className={`flex flex-col items-center rounded-sm px-1.5 py-0.5 text-sm ${tone}`}>
              {body}
            </span>
          );
        }

        return (
          <button
            key={p.index}
            type="button"
            aria-pressed={selected === p.index}
            onClick={() => onSelect(p.index)}
            title={`${p.hm} 收/续点 · 点一下选中它，再记完成时间`}
            className={`flex cursor-pointer flex-col items-center rounded-sm px-1.5 py-0.5 text-sm transition-colors duration-120 ${tone}`}
          >
            {body}
          </button>
        );
      })}

      {/* 结束时间画在时间线**末尾**（2026-09-20 用户反馈）：原先放在左侧信息区竖排，
          与点分离两处，看"最后排到几点"要来回扫。放在线尾后一眼能看出它比最后一个点晚多少
          （22h 的卡：最后一点 02:00、结束 06:00）。
          只读、不参与选中 —— `index = -1` 是哨兵值，不会与收/续点（1..n）或上卡点（0）撞号。
          虚线边框 + 更浅的字色，与"计划态"的虚线区分靠标签本身（写的是「结束」）。 */}
      <span
        title={`卡到期：${endLabelOf(record, now)}（持续时间 ${record.hours} 小时）`}
        className="flex flex-col items-center rounded-sm border border-dashed border-line bg-surface px-1.5 py-0.5 text-sm text-ink-3"
      >
        <span>{endPoint.hm}</span>
        <i className="text-xs not-italic opacity-80">
          {endPoint.dayLabel === '今天' ? '结束' : `结束·${endPoint.dayLabel}`}
        </i>
      </span>
    </div>
  );
}

export default function NurtureSection() {
  const records = useNurtureStore((s) => s.records);
  const add = useNurtureStore((s) => s.add);
  const promote = useNurtureStore((s) => s.promote);
  const markPoint = useNurtureStore((s) => s.markPoint);
  const clearPoint = useNurtureStore((s) => s.clearPoint);
  const remove = useNurtureStore((s) => s.remove);
  const askConfirm = useUiStore((s) => s.askConfirm);

  /**
   * 上卡时间。`null` = 用户还没动过这个框 —— 此时**显示"现在"并跟着时钟走**（2026-09-20 用户要求：
   * 进页面就有值可填，不必自己敲）。跟随而不是"进页面那一刻取一次快照"，是因为后者会让人
   * 停留十分钟后按提交、结果记的是进门时的时间；而一旦手动输入（含清空）就以输入为准。
   */
  const [time, setTime] = useState<string | null>(null);
  /**
   * 结界卡持续时间（小时，2026-09-20 起由用户填它，不再是"推几个点"）。
   * 默认 24 —— 最常见的整日卡，改一个数字比从零输入快。
   */
  const [hours, setHours] = useState(24);
  /**
   * 每次收/续的延迟（分钟，2026-09-20 新增）。默认 0 = 每次都准时；
   * 递推是"每点 +6h +delay"，所以它会累积、也会挤掉点数（见 `pointCountOf`）。
   */
  const [delay, setDelay] = useState(0);
  const [draftError, setDraftError] = useState('');
  /** 待确认的草稿，等用户选「立即开始 / 仅存计划」 */
  const [ask, setAsk] = useState<{ base: string; hours: number; delay: number } | null>(null);
  /** 当前选中的点（每条记录各自的操作对象）；没选时操作条作用于"下一个待办点" */
  const [active, setActive] = useState<{ id: string; index: number } | null>(null);
  /** 每行「实际完成时间」的草稿（`HH:mm`）。**缺键 = 用"现在"**，与上卡时间同一套跟随逻辑 */
  const [doneDraft, setDoneDraft] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => new Date());

  /* 每分钟刷新一次 now：让"已过 / 该收了"自己走，不用用户手动刷新页面。
     6h 粒度下 60s 足够，也不会有明显的重渲染成本。 */
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const { tasks, plans } = useMemo(() => {
    const sorted = sortNurture(records);
    return { tasks: sorted.filter((r) => r.started), plans: sorted.filter((r) => !r.started) };
  }, [records]);

  /** 输入框里此刻该显示的值：用户动过就用他的，没动过就是"现在" */
  const timeValue = time ?? nowHM(now);

  const submit = () => {
    const raw = timeValue.trim();
    if (raw && !normalizeHM(raw)) {
      setDraftError('时间格式应为 HH:mm，例如 21:00');
      return;
    }
    setDraftError('');
    setAsk({ base: normalizeHM(raw) ?? nowHM(now), hours, delay });
  };

  const confirmAdd = (started: boolean) => {
    if (!ask) return;
    add(ask.base, ask.hours, ask.delay, started);
    setAsk(null);
    /* 复位成 `null` 而不是 `''`：下一条又要记的话，框里该是那时的"现在" */
    setTime(null);
  };

  const onRemove = async (r: NurtureRecord) => {
    const ok = await askConfirm({
      title: '删除这条寄养记录？',
      body: `${r.base} 上卡 · 持续 ${r.hours}h（${pointCountOf(r.hours, r.delay)} 个收/续点）${
        r.delay ? ` · 每次延迟 ${r.delay} 分` : ''
      }。删除后不再提醒。`,
      confirmLabel: '删除',
      tone: 'danger',
    });
    if (ok) remove(r.id);
  };

  /** 当前行的操作对象：优先用户点选的，否则取下一个未完成的收/续点 */
  const targetOf = (r: NurtureRecord): NurturePoint | null => {
    const points = recordPoints(r, now);
    const picked = active?.id === r.id ? points.find((p) => p.index === active.index) : undefined;
    return picked ?? nextPendingPoint(r, now);
  };

  /**
   * 记完成：缺键（用户没动过输入框）按「现在」，填了按输入值。
   * 重置时**删键**而不是置空串 —— 空串会让输入框显示空白，而缺键才回到"显示现在"的默认态
   * （`??` 对空串不生效，这是这个 fallback 用「键是否存在」而非「值是否为空」的原因）。
   */
  const submitDone = (r: NurtureRecord, point: NurturePoint) => {
    /* 直接用 `doneDraft` 判空而不是先 fallback 到 `nowHM(now)`：走 `now` 的时分再解析回来，
       会带上"最近一次 tick"最多 60 秒的滞后，而缺键时本可以直接取点击这一刻 */
    const draft = doneDraft[r.id];
    markPoint(r.id, point.index, draft ? (hmToDate(draft, now) ?? new Date()) : new Date());
    setDoneDraft((s) => {
      const next = { ...s };
      delete next[r.id];
      return next;
    });
    setActive(null);
  };

  const row = (r: NurtureRecord) => {
    const points = recordPoints(r, now);
    const stats = r.started ? pointStats(points) : null;
    const target = r.started ? targetOf(r) : null;
    const pickedIndex = active?.id === r.id ? active.index : null;

    return (
      <div key={r.id} className="flex flex-wrap items-start gap-2 border-b border-line-faint px-3 py-2.5 last:border-0">
        <span className="w-24 flex-none">
          <b className="block text-lg font-medium text-ink">{r.base} 上卡</b>
          <span className="block text-sm text-ink-3">
            持续 {r.hours}h · {pointCountOf(r.hours, r.delay)} 个点
            {/* 延迟为 0 时不显示 —— 它是最常见的情况，写出来只会占地方 */}
            {r.delay ? ` · 延 ${r.delay} 分` : ''}
          </span>
          {/* 结束时间已移到右侧时间线的末尾（2026-09-20 用户反馈）—— 与点放在一条线上，
              看"最后排到几点、离卡到期还差多久"不用在两处之间来回扫 */}
          {stats ? (
            <span className="block text-sm text-ink-3">
              已完成 {stats.done} · 待收 {stats.pending}
            </span>
          ) : null}
        </span>

        {/* `min-w-36`（9rem）是**修移动端重叠的关键**：原先只有 `flex-1 min-w-0`，
            `flex-basis: 0` + 可压缩到 0 ⇒ 外层 `flex-wrap` 永远等不到"空间不足"，
            它选择把这一块压扁而不是换行；被压到 0 后里面固定宽的 chip 就溢出自身盒子、
            画到右侧操作条上（桌面够宽所以看不出来）。给了最小宽度，空间不足时才会真正换行。 */}
        <span className="min-w-36 flex-1">
          <PointChips
            record={r}
            now={now}
            selected={pickedIndex}
            onSelect={(index) =>
              setActive((cur) => (cur?.id === r.id && cur.index === index ? null : { id: r.id, index }))
            }
          />
        </span>

        {!r.started ? (
          <button
            type="button"
            onClick={() => promote(r.id)}
            className="flex-none cursor-pointer rounded-sm bg-brand px-2 py-1 text-sm text-white transition-colors duration-120 hover:bg-brand-deep"
          >
            开始
          </button>
        ) : target ? (
          /* 操作条只作用于 `target`（选中点，或下一个待办点）—— 记完成只影响它之后的点。
             不用 `flex-none`：那个值让它按 max-content 定宽、窄屏下直接溢出容器；
             去掉后配合 `min-w-0` 与内部的 `flex-wrap`，装不下时改在**自己内部**换行。 */
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="text-sm text-ink-3">
              {target.doneAt !== undefined
                ? `${target.hm} 已完成`
                : target.past
                  ? `${target.hm} 该收了`
                  : `${target.hm} 待收`}
            </span>
            <input
              type="time"
              value={doneDraft[r.id] ?? nowHM(now)}
              onChange={(e) => setDoneDraft((s) => ({ ...s, [r.id]: e.target.value }))}
              aria-label={`${target.hm} 的实际完成时间`}
              title="实际完成时间；默认已填当前时间，可改"
              className="w-[5.6rem] rounded-sm border border-line bg-surface px-1.5 py-1 text-sm text-ink transition-colors duration-120 focus:border-brand"
            />
            <button
              type="button"
              onClick={() => submitDone(r, target)}
              title={
                target.doneAt !== undefined
                  ? '改这个点的实际完成时间（这个点与它之后的点都会重算）'
                  : '记这个点完成；这个点显示为实际时间，之后的点按实际时间 + 6h 顺延'
              }
              className="flex-none cursor-pointer rounded-sm bg-brand px-2 py-1 text-sm text-white transition-colors duration-120 hover:bg-brand-deep"
            >
              {target.doneAt !== undefined ? '改时间' : '记完成'}
            </button>
            {target.doneAt !== undefined ? (
              <button
                type="button"
                onClick={() => {
                  clearPoint(r.id, target.index);
                  setActive(null);
                }}
                title="取消这个点的完成记录，回到按预计时间推"
                className="flex-none cursor-pointer rounded-sm border border-line px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
              >
                取消完成
              </button>
            ) : null}
          </span>
        ) : (
          <span className="flex-none text-sm text-success-deep">全部完成</span>
        )}

        <button
          type="button"
          aria-label="删除记录"
          onClick={() => void onRemove(r)}
          className="flex-none cursor-pointer rounded-sm border border-line px-1.5 py-1 text-ink-3 transition-colors duration-120 hover:border-danger-line hover:text-danger"
        >
          <Trash2 size={12} strokeWidth={2} />
        </button>
      </div>
    );
  };

  return (
    <div className="pb-6">
      <div className="mx-3.5 mt-3 rounded-md bg-surface-3 px-3 py-2.5 text-sm leading-relaxed text-ink-2">
        <b className="text-ink">结界寄养每次 6 小时</b>。填上卡时间、<b className="text-ink">卡的持续时间</b>
        （如 22 小时）与<b className="text-ink">每次的延迟</b>（分钟，默认 0）→
        自动排出收/续点（每点 = 前一点 + 6 小时 + 延迟，如 6:00 上卡、延迟 5 → 12:05 → 18:10），
        跨天标明天/后天；<b className="text-ink">上卡时刻也作为一个点显示在任务里</b>，
        <b className="text-ink">结束时间</b>由持续时间推算、只读不可改。
        <b className="text-ink">每个点各自记完成</b>：点一下那个时间点，再用「现在」或填实际时间 ——
        这个点会显示为你填的实际时间，之后的点按实际时间 + 6h 顺延，之前的点不动。
        <b className="text-ink">添加时先问你要不要「立即开始」</b> —— 开始才算任务、才记录完成；
        仅存计划的纯查看（虚线），不背状态。
      </div>

      <div className="mx-3.5 mt-3 rounded-md border border-line-soft bg-surface px-3 py-2.5">
        <p className="text-lg text-ink">记一次结界寄养</p>
        <p className="mt-0.5 text-sm text-ink-3">
          上卡时间已默认填当前时间；填结界卡的持续时间，收/续点按每 6h 自动排
        </p>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-12 flex-none text-sm text-ink-3">上卡</span>
          <input
            value={timeValue}
            onChange={(e) => setTime(e.target.value)}
            placeholder="如 21:00"
            aria-label="上卡时间"
            className="min-w-0 flex-1 rounded-sm border border-line bg-surface px-2 py-1.5 text-lg text-ink transition-colors duration-120 focus:border-brand"
          />
          <button
            type="button"
            onClick={() => setTime(null)}
            className="flex-none cursor-pointer rounded-sm border border-line px-2 py-1.5 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
          >
            用现在
          </button>
        </div>

        {/* 持续时间（2026-09-20 取代原来的「推点数」按钮组）：用户手里的事实是"这张卡能撑多久"，
            "排几个点"是寄养机制的内部换算，不该让人心算 22/6 */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="w-12 flex-none text-sm text-ink-3">持续</span>
          <input
            type="number"
            min={1}
            max={MAX_NURTURE_HOURS}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            aria-label="结界卡持续时间（小时）"
            className="w-20 rounded-sm border border-line bg-surface px-2 py-1.5 text-lg text-ink transition-colors duration-120 focus:border-brand"
          />
          {/* 延迟（2026-09-20 新增）：每次收/续往后推几分钟。它逐点累积，
              所以点数提示必须带上它 —— 24h 的卡配 5 分钟延迟会从 4 个点变成 3 个 */}
          <span className="w-12 flex-none text-sm text-ink-3">延迟</span>
          <input
            type="number"
            min={0}
            max={MAX_NURTURE_DELAY}
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
            aria-label="每次收续延迟（分钟）"
            className="w-20 rounded-sm border border-line bg-surface px-2 py-1.5 text-lg text-ink transition-colors duration-120 focus:border-brand"
          />
          <span className="text-sm text-ink-3">
            分钟 · 将排 <b className="font-medium text-ink-2">{pointCountOf(hours, delay)}</b> 个收/续点
          </span>
        </div>

        {/* 结束时间**只读**（2026-09-20 用户要求）：由「上卡 + 持续」推算，不给编辑入口。
            用 `endLabelOf` 而不是自己拼日期，是为了与点 chip 共用同一套日标签口径 */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="w-12 flex-none text-sm text-ink-3">结束</span>
          <span
            className="rounded-sm bg-surface-3 px-2 py-1.5 text-lg text-ink-2"
            title="结束时间 = 上卡时间 + 持续时间，不可单独修改"
          >
            {endLabelOf({ base: timeValue, hours }, now)}
          </span>
          <span className="text-sm text-ink-3">（由上卡与持续时间推算，不可修改）</span>
        </div>

        {draftError ? <p className="mt-2 text-sm text-danger">{draftError}</p> : null}

        <div className="mt-2">
          <button
            type="button"
            onClick={submit}
            className="inline-flex cursor-pointer items-center gap-1 rounded-sm bg-brand px-2.5 py-1.5 text-sm text-white transition-colors duration-120 hover:bg-brand-deep"
          >
            <Plus size={12} strokeWidth={2.4} />
            下一步：确认添加
          </button>
        </div>
      </div>

      {ask ? (
        <div className="mx-3.5 mt-2 flex flex-wrap items-center gap-2 rounded-md border border-brand bg-brand-soft px-3 py-2">
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-brand">
            <b>{ask.base}</b> 上卡 · 持续 <b>{ask.hours}h</b>
            {ask.delay ? <> · 延迟 <b>{ask.delay}</b> 分</> : null} ·{' '}
            <b>{pointCountOf(ask.hours, ask.delay)}</b> 个收/续点 · 结束 <b>{endLabelOf(ask, now)}</b>
            {' —— '}现在就开始记状态，还是先存为计划？
          </p>
          <button
            type="button"
            onClick={() => confirmAdd(true)}
            className="flex-none cursor-pointer rounded-sm bg-brand px-2 py-1 text-sm text-white transition-colors duration-120 hover:bg-brand-deep"
          >
            立即开始
          </button>
          <button
            type="button"
            onClick={() => confirmAdd(false)}
            className="flex-none cursor-pointer rounded-sm border border-brand px-2 py-1 text-sm text-brand transition-colors duration-120 hover:bg-surface"
          >
            仅存计划
          </button>
          <button
            type="button"
            onClick={() => setAsk(null)}
            className="flex-none cursor-pointer rounded-sm px-2 py-1 text-sm text-brand transition-colors duration-120 hover:bg-surface"
          >
            取消
          </button>
        </div>
      ) : null}

      <div className="flex items-baseline justify-between px-3.5 pb-1 pt-4">
        <span className="text-sm text-ink-3">进行中的任务 · {tasks.length} 条</span>
        <span className="text-sm text-ink-3">✓=已完成 · 橙=该收了 · 点时间点可记完成</span>
      </div>
      {tasks.length ? (
        <div className="mx-3.5 overflow-hidden rounded-md border border-line-soft bg-surface">{tasks.map(row)}</div>
      ) : (
        <p className="mx-3.5 rounded-md bg-surface-3 px-3 py-2.5 text-sm leading-relaxed text-ink-3">
          没有进行中的任务 —— 表单填好时间点，选「立即开始」后这里才开始记录完成情况。
        </p>
      )}

      <div className="flex items-baseline justify-between px-3.5 pb-1 pt-4">
        <span className="text-sm text-ink-3">计划清单 · {plans.length} 条</span>
        <span className="text-sm text-ink-3">未开始不记状态 · 可点「开始」转正</span>
      </div>
      {plans.length ? (
        <div className="mx-3.5 overflow-hidden rounded-md border border-line-soft bg-surface">{plans.map(row)}</div>
      ) : (
        <p className="mx-3.5 rounded-md bg-surface-3 px-3 py-2.5 text-sm leading-relaxed text-ink-3">
          计划清单为空。「仅存计划」的条目放这里：纯查看不记状态，决定开刷时点「开始」转成任务。
        </p>
      )}

      <p className="px-3.5 pt-4 text-sm leading-relaxed text-ink-3">
        寄养记录按<b className="text-ink-2">档案</b>保存：换号会切到该号自己的那份，且随备份一起走
        （「我的 → 数据备份」），换设备时导一次即可带走。
      </p>
    </div>
  );
}
