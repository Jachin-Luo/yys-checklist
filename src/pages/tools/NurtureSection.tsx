import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MAX_NURTURE_N, nextPointIndex, normalizeHM, nowHM, nurturePoints, pointStats, sortNurture, type NurtureRecord } from '../../domain/nurture';
import { useNurtureStore } from '../../stores/nurture';
import { useUiStore } from '../../stores/ui';

/**
 * 结界寄养（S6）。
 *
 * 规则：每次 6 小时，一天理论 4 次。填上卡时间 → 自动排出往后每 6h 的收/续点。
 *
 * **两个列表是刻意的**：添加时先问「立即开始 / 仅存计划」。
 * 任务才记录已过/未到（灰=已过、绿=未到、紫描边=下一个）；计划纯查看不背状态，
 * 决定开刷时点「开始」转正。用户常常只是"打算这个点寄"，不想一存就被判成未到。
 *
 * 数据落在设备级键（`yys:plans`）：与玩哪个号无关，见 stores/nurture.ts 的说明。
 */

/** 任务状态的 chip：已过灰 / 下一个品牌描边 / 未到绿 */
function PointChips({ record, now }: { record: NurtureRecord; now: Date }) {
  const points = nurturePoints(record.base, record.n, now);
  const next = record.started ? nextPointIndex(points) : -1;
  return (
    <div className="flex flex-wrap gap-1">
      {points.map((p, i) => {
        const tone = !record.started
          ? 'border border-dashed border-line text-ink-3'
          : p.past
            ? 'bg-surface-3 text-ink-3'
            : i === next
              ? 'border border-brand bg-brand-soft text-brand'
              : 'bg-surface-3 text-success-deep';
        return (
          <span key={p.ts} className={`flex flex-col items-center rounded-sm px-1.5 py-0.5 text-sm ${tone}`}>
            {p.hm}
            <i className="text-xs not-italic opacity-80">{p.dayLabel}</i>
          </span>
        );
      })}
    </div>
  );
}

export default function NurtureSection() {
  const records = useNurtureStore((s) => s.records);
  const hydrate = useNurtureStore((s) => s.hydrate);
  const add = useNurtureStore((s) => s.add);
  const promote = useNurtureStore((s) => s.promote);
  const remove = useNurtureStore((s) => s.remove);
  const askConfirm = useUiStore((s) => s.askConfirm);

  const [time, setTime] = useState('');
  const [n, setN] = useState(4);
  const [draftError, setDraftError] = useState('');
  /** 待确认的草稿：`{ base, n }`，等用户选「立即开始 / 仅存计划」 */
  const [ask, setAsk] = useState<{ base: string; n: number } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  /* 每分钟刷新一次 now：让"已过/未到"自己走，不用用户手动刷新页面。
     6h 粒度下 60s 足够，也不会有明显的重渲染成本。 */
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const { tasks, plans } = useMemo(() => {
    const sorted = sortNurture(records);
    return { tasks: sorted.filter((r) => r.started), plans: sorted.filter((r) => !r.started) };
  }, [records]);

  const submit = () => {
    const raw = time.trim();
    if (raw && !normalizeHM(raw)) {
      setDraftError('时间格式应为 HH:mm，例如 21:00；留空表示"现在"');
      return;
    }
    setDraftError('');
    setAsk({ base: normalizeHM(raw) ?? nowHM(now), n });
  };

  const confirmAdd = (started: boolean) => {
    if (!ask) return;
    add(ask.base, ask.n, started);
    setAsk(null);
    setTime('');
  };

  const onRemove = async (r: NurtureRecord) => {
    const ok = await askConfirm({
      title: '删除这条寄养记录？',
      body: `${r.base} 上卡 · 每 6h × ${r.n}。删除后不再提醒这些收/续点。`,
      confirmLabel: '删除',
      tone: 'danger',
    });
    if (ok) remove(r.id);
  };

  const row = (r: NurtureRecord) => {
    const stats = r.started ? pointStats(nurturePoints(r.base, r.n, now)) : null;
    return (
      <div key={r.id} className="flex flex-wrap items-start gap-2 border-b border-line-faint px-3 py-2.5 last:border-0">
        <span className="w-24 flex-none">
          <b className="block text-lg font-medium text-ink">{r.base} 上卡</b>
          <span className="block text-sm text-ink-3">每 6h × {r.n}</span>
          {stats ? (
            <span className="block text-sm text-ink-3">
              已过 {stats.past} · 未到 {stats.future}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <PointChips record={r} now={now} />
        </span>
        {!r.started ? (
          <button
            type="button"
            onClick={() => promote(r.id)}
            className="flex-none cursor-pointer rounded-sm bg-brand px-2 py-1 text-sm text-white transition-colors duration-120 hover:bg-brand-deep"
          >
            开始
          </button>
        ) : null}
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
        <b className="text-ink">结界寄养每次 6 小时</b>，一天理论可寄 4 次。记下上卡时间，自动排出之后每 6h
        的收/续点（跨天标明天/后天）。
        <b className="text-ink">添加时先问你要不要「立即开始」</b> —— 开始才算任务、才记录已过/未到；
        仅存计划的纯查看，不背状态。
      </div>

      <div className="mx-3.5 mt-3 rounded-md border border-line-soft bg-surface px-3 py-2.5">
        <p className="text-lg text-ink">记一次结界寄养</p>
        <p className="mt-0.5 text-sm text-ink-3">
          填上卡时间 + 选往后推几个 6h 点（4 ≈ 覆盖满 24h · 6 星卡剩余不足 24h 选 3）
        </p>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-12 flex-none text-sm text-ink-3">上卡</span>
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="如 21:00 · 留空 = 现在"
            aria-label="上卡时间"
            className="min-w-0 flex-1 rounded-sm border border-line bg-surface px-2 py-1.5 text-lg text-ink transition-colors duration-120 focus:border-brand"
          />
          <button
            type="button"
            onClick={() => setTime(nowHM(now))}
            className="flex-none cursor-pointer rounded-sm border border-line px-2 py-1.5 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
          >
            用现在
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-12 flex-none text-sm text-ink-3">推点数</span>
          <div className="flex gap-1">
            {Array.from({ length: MAX_NURTURE_N }, (_, i) => i + 1).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setN(x)}
                className={`cursor-pointer rounded-sm border px-2.5 py-1 text-sm transition-colors duration-120 ${
                  n === x ? 'border-brand bg-brand text-white' : 'border-line text-ink-2 hover:border-ink-4'
                }`}
              >
                {x} 次
              </button>
            ))}
          </div>
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
            <b>{ask.base}</b> 上卡 · 每 6h 推 <b>{ask.n} 点</b>
            {nurturePoints(ask.base, ask.n, now)[0] ? ` · 首点 ${nurturePoints(ask.base, ask.n, now)[0].hm}` : ''}
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
        <span className="text-sm text-ink-3">绿=未到 · 灰=已过 · 紫描边=下一个</span>
      </div>
      {tasks.length ? (
        <div className="mx-3.5 overflow-hidden rounded-md border border-line-soft bg-surface">{tasks.map(row)}</div>
      ) : (
        <p className="mx-3.5 rounded-md bg-surface-3 px-3 py-2.5 text-sm leading-relaxed text-ink-3">
          没有进行中的任务 —— 表单填好时间点，选「立即开始」后这里才开始记录已过/未到。
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
        寄养记录只存在本机（设备级，不随游戏档案走、不上传）—— 换设备或清理浏览器数据会丢。
      </p>
    </div>
  );
}
