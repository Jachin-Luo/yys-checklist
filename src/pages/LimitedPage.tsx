import { useMemo } from 'react';
import Alert from '../components/common/Alert';
import ChecklistItem from '../components/common/ChecklistItem';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import ViewBar from '../components/common/ViewBar';
import { daysLeft } from '../domain/countdown';
import { buildComparator, isVisible } from '../domain/sort';
import { useCheckStore } from '../stores/check';
import { useItemStore } from '../stores/items';
import { useViewStore } from '../stores/view';
import { CHECKLIST_GRID } from '../styles/layout';

/**
 * 限时活动看板（设计文档 §9 S4b-2）。
 *
 * 固定按**剩余天数升序**（"哪个快过期了"是清单唯一不可替代的能力，需求 §6），
 * 因此不提供排序控件（`showSort={false}`）—— 给一个点了不生效的控件会误导。
 * `until` 到期的条目已由 `activeItems()` 在 bootstrap 阶段过滤掉，此处不再判。
 *
 * 「版本 / 赛季」分区（2026-09-11 用户决策）：version / season 条目从周页挪到这里单独成区 ——
 * 它们随周期滚动、没有 deadline，混进倒计时列表只会永远垫底、还会稀释临期预警。
 * 仅视图归属变化：cycle 字段、重置锚点与统计口径（本月含这两类）均不变。
 */
export default function LimitedPage({ variant }: { variant: 'mobile' | 'desktop' }) {
  const items = useItemStore((s) => s.items);
  const overrides = useItemStore((s) => s.overrides);
  const checked = useCheckStore((s) => s.checked);
  const view = useViewStore((s) => s.view);

  const { pending, done, urgent, extraPending, extraDone, oncePending, onceDone } = useMemo(() => {
    const now = new Date();
    const visibility = {
      showKinds: view.showKinds as string[],
      hideDone: view.hideDone,
      today: now.getDay(),
    };
    const list = items
      .filter((it) => it.cycle === 'limited')
      .filter((it) => isVisible(it, checked[it.id], visibility))
      .sort(
        buildComparator({ sortBy: 'deadline', pinned: view.pinned, order: overrides?.order ?? [] }),
      );

    /* 版本 / 赛季条目单独成区：无 deadline，不参与"剩余天数升序"与临期预警（理由见组件注释） */
    const extra = items
      .filter((it) => it.cycle === 'version' || it.cycle === 'season')
      .filter((it) => isVisible(it, checked[it.id], visibility))
      .sort(
        buildComparator({ sortBy: 'deadline', pinned: view.pinned, order: overrides?.order ?? [] }),
      );

    const once = items
      .filter((it) => it.cycle === 'once')
      .filter((it) => isVisible(it, checked[it.id], visibility))
      .sort(
        buildComparator({ sortBy: 'deadline', pinned: view.pinned, order: overrides?.order ?? [] }),
      );

    const undone = list.filter((it) => checked[it.id] === undefined);
    return {
      pending: undone,
      done: list.filter((it) => checked[it.id] !== undefined),
      extraPending: extra.filter((it) => checked[it.id] === undefined),
      extraDone: extra.filter((it) => checked[it.id] !== undefined),
      oncePending: once.filter((it) => checked[it.id] === undefined),
      onceDone: once.filter((it) => checked[it.id] !== undefined),
      urgent: undone.filter((it) => {
        const d = daysLeft(it.deadline, now);
        return d !== null && d > 0 && d <= 3;
      }).length,
    };
  }, [items, checked, view, overrides]);

  return (
    <div className="pb-6">
      <ViewBar mode={variant} />

      {pending.length ? (
        <Alert tone={urgent ? 'danger' : 'warn'}>
          {pending.length} 个活动在跑
          {urgent ? ` · ${urgent} 个将在 3 天内截止` : ' · 暂无临期'}
        </Alert>
      ) : null}

      <SectionTitle>限时活动 · {pending.length} 个进行中</SectionTitle>
      {pending.length ? (
        <div className={CHECKLIST_GRID}>
          {pending.map((item) => (
            <ChecklistItem key={item.id} item={item} showDeadline />
          ))}
        </div>
      ) : (
        <EmptyState
          title="当前没有进行中的限时活动"
          hint="活动结束后条目会在下线日自动归档。新活动可在「我的」里手动添加自建条目。"
        />
      )}

      {done.length ? (
        <>
          <SectionTitle>已完成 · {done.length} 项</SectionTitle>
          <div className={CHECKLIST_GRID}>
            {done.map((item) => (
              <ChecklistItem key={item.id} item={item} showDeadline />
            ))}
          </div>
        </>
      ) : null}

      {/* 版本 / 赛季分区：随周期滚动、无固定截止，与倒计时型限时活动分开渲染 */}
      {extraPending.length || extraDone.length ? (
        <>
          {/* 重置提示（2026-09-14 从本周页移来）：版本活动在上线当日维护完成后才计入，
              锚点是维护完成那一刻（通常 9:00），不是当天 0 点 —— 所以维护期间不会提前翻篇 */}
          <Alert tone="warn">
            版本 / 赛季按开服锚点重置 · 版本活动于上线当日维护完成后（通常 9:00）才计入
          </Alert>
          <SectionTitle>
            版本 / 赛季 · {extraPending.length} 项待做
            {extraDone.length ? ` · 已完成 ${extraDone.length}` : ''}
          </SectionTitle>
          <div className={CHECKLIST_GRID}>
            {[...extraPending, ...extraDone].map((item) => (
              <ChecklistItem key={item.id} item={item} showDeadline />
            ))}
          </div>
        </>
      ) : null}

      {oncePending.length || onceDone.length ? (
        <>
          <SectionTitle>
            一次性 · {oncePending.length} 项待做
            {onceDone.length ? ` · 已完成 ${onceDone.length}` : ''}
          </SectionTitle>
          <div className={CHECKLIST_GRID}>
            {[...oncePending, ...onceDone].map((item) => (
              <ChecklistItem key={item.id} item={item} showDeadline={Boolean(item.deadline)} />
            ))}
          </div>
        </>
      ) : null}

      <p className="px-3.5 pt-4 text-sm leading-relaxed text-ink-3">
        每张卡右侧标注截止日期与剩余天数：≤7 天转橙、≤3 天转红，活动结束后自动移出。
        没标截止的（如联动、待定档）按「截止未定」处理，以游戏内为准。
      </p>
    </div>
  );
}
