import ChecklistItem from '../components/common/ChecklistItem';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import PageHead from '../components/common/PageHead';
import ViewBar from '../components/common/ViewBar';
import { KikyoBand } from '../components/ornament';
import { weekRangeLabel } from '../domain/dateLabel';
import { useChecklist } from '../hooks/useChecklist';
import { usePeriodCountdown } from '../hooks/usePeriodCountdown';
import { CHECKLIST_GRID } from '../styles/layout';

/**
 * 本周页（设计文档 §9 S4b-1）：周常条目。
 *
 * 月常已于 2026-09-15 拆到「本月」页 —— 两者刷新口径不同（周一 0 点 vs 每月 1 日 0 点），
 * 混在一页时"哪几条下周才会翻篇"看不出来。版本 / 赛季条目在限时页的专属分区
 * （随 `meta.periods` 锚点滚动，与"周"无关）。
 *
 * 2026-09-23 换肤：日期行升格为 `PageHead`（衬线标题 + 唯一的等宽倒计时），
 * 分组头换成朱印分组头（图标 + 计数 pill + 真实完成比例底轨）。
 */
export default function WeekPage({ variant }: { variant: 'mobile' | 'desktop' }) {
  const { pending, done, coveredSet, coverMode } = useChecklist('week');
  const isDimmed = (id: string) => coverMode === 'dim' && coveredSet.has(id);
  /* 距下周一 0 点还有多久（与勾选重置同源） */
  const countdown = usePeriodCountdown('weekly');

  const total = pending.length + done.length;

  return (
    <div className="pb-6">
      {/* 筛选 2026-09-23 起整体下线（`stores/view.SHOW_KIND_FILTER`）：此处 ViewBar 渲染空。
          调用保留，是为了恢复时不必回来改页面 */}
      {variant === 'desktop' ? <ViewBar mode="desktop" /> : null}

      {/* 顶部日期：自然周周一–周日，纯展示 —— 与「周一 0 点刷新」的勾选语义无关（domain/dateLabel）。
          右侧倒计时才是刷新口径，它走 domain/reset 的周期终点 */}
      <PageHead
        title="本周"
        detail={<>本周 {weekRangeLabel(new Date())}</>}
        countdown={countdown}
        countdownLabel="周常重置"
        action={variant === 'mobile' ? <ViewBar mode="mobile" /> : null}
      />

      {/* 重置提示已移到限时页的「版本 / 赛季」分区（2026-09-14）：周常 0 点刷新是常识，
          而"版本 / 赛季按锚点重置"只对那一类条目有意义 */}
      <SectionTitle
        icon="ougi"
        count={pending.length}
        progress={total ? done.length / total : undefined}
      >
        本周待做
      </SectionTitle>
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
          <SectionTitle icon="suzu" count={done.length}>
            已完成
          </SectionTitle>
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

      <KikyoBand className="mx-3.5 mt-6 opacity-90" />
    </div>
  );
}
