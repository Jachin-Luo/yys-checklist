import ChecklistItem from '../components/common/ChecklistItem';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import ViewBar from '../components/common/ViewBar';
import { monthRangeLabel } from '../domain/dateLabel';
import { useChecklist } from '../hooks/useChecklist';
import { usePeriodCountdown } from '../hooks/usePeriodCountdown';
import { CHECKLIST_GRID } from '../styles/layout';

/**
 * 本月页（2026-09-15 用户需求）：月常条目独立成页。
 *
 * 此前月常与周常同在本周页（设计文档 §9 S4b-1），但两者刷新口径不同 ——
 * 周常周一 0 点、月常每月 1 日 0 点，混在一起时"哪几条下周才会翻篇"看不出来。
 * 版本 / 赛季条目仍留在限时页的专属分区：它们随 `meta.periods` 锚点滚动、无固定截止，
 * 与月常不是一回事（统计口径不受影响，`domain/stats` 的 month 仍覆盖这三个周期）。
 */
export default function MonthPage({ variant }: { variant: 'mobile' | 'desktop' }) {
  const { pending, done, coveredSet, coverMode } = useChecklist('month');
  const isDimmed = (id: string) => coverMode === 'dim' && coveredSet.has(id);
  /* 距下月 1 日 0 点还有多久（与勾选重置同源） */
  const countdown = usePeriodCountdown('monthly');

  return (
    <div className="pb-6">
      <ViewBar mode={variant} />

      {/* 顶部日期：自然月区间，纯展示 —— 与「每月 1 日 0 点刷新」的勾选语义无关（domain/dateLabel）。
          月常刷新不是常识（周常周一刷新才是），所以这一页把刷新点写在日期旁边；
          末尾再接具体还剩多久 —— 规则与倒计时并列，既说清"什么时候刷"也说清"还有多久" */}
      <p className="px-3.5 pt-2.5 text-sm text-ink-3">
        本月 <b className="font-medium text-ink">{monthRangeLabel(new Date())}</b> · 每月 1 日 0 点刷新
        {countdown ? (
          <>
            {' · '}
            <b className="font-medium text-ink-2">{countdown}</b>
          </>
        ) : null}
      </p>

      <SectionTitle>本月 · {pending.length} 项未完成</SectionTitle>
      {pending.length ? (
        <div className={CHECKLIST_GRID}>
          {pending.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              dimmed={isDimmed(item.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="本月已全部完成" hint="每月 1 日会自动重置为未完成状态。" />
      )}

      {done.length ? (
        <>
          <SectionTitle>已完成 · {done.length} 项</SectionTitle>
          <div className={CHECKLIST_GRID}>
            {done.map((item) => (
              <ChecklistItem
                key={item.id}
                item={item}
                dimmed={isDimmed(item.id)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
