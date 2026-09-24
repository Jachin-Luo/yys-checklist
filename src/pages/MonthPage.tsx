import ChecklistEntry from '../components/common/ChecklistEntry';
import { groupChecklist } from '../domain/grouping';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import PageHead from '../components/common/PageHead';
import ViewBar from '../components/common/ViewBar';
import { KikyoBand } from '../components/ornament';
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
 *
 * 2026-09-23 换肤：同本周页（`PageHead` + 朱印分组头 + 收束纹带）。
 */
export default function MonthPage({ variant }: { variant: 'mobile' | 'desktop' }) {
  const { pending, done, coveredSet, coverMode } = useChecklist('month');
  const isDimmed = (id: string) => coverMode === 'dim' && coveredSet.has(id);
  /* 距下月 1 日 0 点还有多久（与勾选重置同源） */
  const countdown = usePeriodCountdown('monthly');

  const total = pending.length + done.length;

  return (
    <div className="pb-6">
      {/* 筛选 2026-09-23 起整体下线（`stores/view.SHOW_KIND_FILTER`）：此处 ViewBar 渲染空。
          调用保留，是为了恢复时不必回来改页面 */}
      {variant === 'desktop' ? <ViewBar mode="desktop" /> : null}

      {/* 顶部日期：自然月区间，纯展示 —— 与「每月 1 日 0 点刷新」的勾选语义无关（domain/dateLabel）。
          月常刷新不是常识（周常周一刷新才是），所以这一页把刷新点写在日期旁边；
          右侧再接具体还剩多久 —— 规则与倒计时并列，既说清"什么时候刷"也说清"还有多久" */}
      <PageHead
        title="本月"
        detail={<>本月 {monthRangeLabel(new Date())} · 每月 1 日 0 点刷新</>}
        countdown={countdown}
        countdownLabel="月常重置"
        action={variant === 'mobile' ? <ViewBar mode="mobile" /> : null}
      />

      <SectionTitle
        icon="koyomi"
        count={pending.length}
        progress={total ? done.length / total : undefined}
      >
        本月待做
      </SectionTitle>
      {pending.length ? (
        <div className={CHECKLIST_GRID}>
          {groupChecklist(pending, done).pending.map((u) => (
            <ChecklistEntry key={u.key} unit={u} dimmedOf={isDimmed} />
          ))}
        </div>
      ) : (
        <EmptyState title="本月已全部完成" hint="每月 1 日会自动重置为未完成状态。" />
      )}

      {done.length ? (
        <>
          <SectionTitle icon="done" count={done.length}>
            已完成
          </SectionTitle>
          <div className={CHECKLIST_GRID}>
            {groupChecklist(pending, done).done.map((u) => (
              <ChecklistEntry key={u.key} unit={u} dimmedOf={isDimmed} />
            ))}
          </div>
        </>
      ) : null}

      <KikyoBand className="mx-3.5 mt-6 opacity-90" />
    </div>
  );
}
