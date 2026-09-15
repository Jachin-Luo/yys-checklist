import ChecklistItem from '../components/common/ChecklistItem';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import ViewBar from '../components/common/ViewBar';
import { weekRangeLabel } from '../domain/dateLabel';
import { useChecklist } from '../hooks/useChecklist';
import { CHECKLIST_GRID } from '../styles/layout';

/**
 * 本周页（设计文档 §9 S4b-1）：周常条目。
 *
 * 月常已于 2026-09-15 拆到「本月」页 —— 两者刷新口径不同（周一 0 点 vs 每月 1 日 0 点），
 * 混在一页时"哪几条下周才会翻篇"看不出来。版本 / 赛季条目在限时页的专属分区
 * （随 `meta.periods` 锚点滚动，与"周"无关）。
 */
export default function WeekPage({ variant }: { variant: 'mobile' | 'desktop' }) {
  const { pending, done, coveredSet, coverMode } = useChecklist('week');
  const isDimmed = (id: string) => coverMode === 'dim' && coveredSet.has(id);

  return (
    <div className="pb-6">
      <ViewBar mode={variant} />

      {/* 顶部日期：自然周周一–周日，纯展示 —— 与「周一 0 点刷新」的勾选语义无关（domain/dateLabel） */}
      <p className="px-3.5 pt-2.5 text-sm text-ink-3">
        本周 <b className="font-medium text-ink">{weekRangeLabel(new Date())}</b>
      </p>

      {/* 重置提示已移到限时页的「版本 / 赛季」分区（2026-09-14）：周常 0 点刷新是常识，
          而"版本 / 赛季按锚点重置"只对那一类条目有意义 */}
      <SectionTitle>本周 · {pending.length} 项未完成</SectionTitle>
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
        <EmptyState title="本周已全部完成" hint="下周一会自动重置为未完成状态。" />
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
