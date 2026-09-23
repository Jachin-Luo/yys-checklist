import { useMemo } from 'react';
import Alert from '../components/common/Alert';
import ChecklistItem from '../components/common/ChecklistItem';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import PageHead from '../components/common/PageHead';
import ViewBar from '../components/common/ViewBar';
import { KikyoBand } from '../components/ornament';
import { daysLeft } from '../domain/countdown';
import { buildComparator, isVisible } from '../domain/sort';
import { useCheckStore } from '../stores/check';
import { useItemStore } from '../stores/items';
import { SHOW_KIND_FILTER, useViewStore } from '../stores/view';
import { CHECKLIST_GRID } from '../styles/layout';

/**
 * 限时活动看板（设计文档 §9 S4b-2）。
 *
 * 固定按**剩余天数升序**（"哪个快过期了"是清单唯一不可替代的能力，需求 §6），
 * 因此不提供排序控件 —— 给一个点了不生效的控件会误导。
 * `until` 到期的条目已由 `activeItems()` 在 bootstrap 阶段过滤掉，此处不再判。
 *
 * 「版本 / 赛季」分区（2026-09-11 用户决策）：version / season 条目从周页挪到这里单独成区 ——
 * 它们随周期滚动、没有 deadline，混进倒计时列表只会永远垫底、还会稀释临期预警。
 * 仅视图归属变化：cycle 字段、重置锚点与统计口径（本月含这两类）均不变。
 *
 * 2026-09-23 换肤：本页的「唯一高亮位」给**临期条目**（≤3 天）——
 * 这一屏最需要行动的就是"马上要过期的那几个"，其余条目走常规卡面。
 * 参考稿铁律二：全屏只有一处允许"高饱和色 + 金描边 + 淡色底"。
 */
export default function LimitedPage({ variant }: { variant: 'mobile' | 'desktop' }) {
  const items = useItemStore((s) => s.items);
  const overrides = useItemStore((s) => s.overrides);
  const checked = useCheckStore((s) => s.checked);
  const view = useViewStore((s) => s.view);

  const { pending, done, urgentIds, extraPending, extraDone, oncePending, onceDone } = useMemo(() => {
    const now = new Date();
    const visibility = {
      /* 同 `hooks/useChecklist`：筛选总开关关着时传空数组（见 `stores/view.SHOW_KIND_FILTER`） */
      showKinds: SHOW_KIND_FILTER ? (view.showKinds as string[]) : [],
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
    const isUrgent = (it: { deadline?: string }) => {
      const d = daysLeft(it.deadline, now);
      return d !== null && d > 0 && d <= 3;
    };
    return {
      pending: undone,
      done: list.filter((it) => checked[it.id] !== undefined),
      extraPending: extra.filter((it) => checked[it.id] === undefined),
      extraDone: extra.filter((it) => checked[it.id] !== undefined),
      oncePending: once.filter((it) => checked[it.id] === undefined),
      onceDone: once.filter((it) => checked[it.id] !== undefined),
      urgentIds: new Set(undone.filter(isUrgent).map((it) => it.id)),
    };
  }, [items, checked, view, overrides]);

  const urgent = urgentIds.size;

  return (
    <div className="pb-6">
      {/* 筛选 2026-09-23 起整体下线（`stores/view.SHOW_KIND_FILTER`）：此处 ViewBar 渲染空。
          调用保留，是为了恢复时不必回来改页面 */}
      {variant === 'desktop' ? <ViewBar mode="desktop" /> : null}

      {/* 页头不再复述"N 个活动在跑 · 临期几天" —— 下一行的警示条已经说了同一句话，
          两处逐字相同只会多占一行高度（首屏高度在移动端尤其贵） */}
      <PageHead
        title="限时"
        action={variant === 'mobile' ? <ViewBar mode="mobile" /> : null}
      />

      {pending.length ? (
        <Alert tone={urgent ? 'danger' : 'warn'}>
          {pending.length} 个活动在跑
          {urgent ? ` · ${urgent} 个将在 3 天内截止` : ' · 暂无临期'}
        </Alert>
      ) : null}

      <SectionTitle
        icon="chochin"
        count={pending.length}
        progress={pending.length + done.length ? done.length / (pending.length + done.length) : undefined}
      >
        限时活动 · 进行中
      </SectionTitle>
      {pending.length ? (
        <div className={CHECKLIST_GRID}>
          {pending.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              showDeadline
              highlight={urgentIds.has(item.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="当前没有进行中的限时活动"
          hint="活动结束后条目会在下线日自动归档。新活动可在「设置」里手动添加自建条目。"
        />
      )}

      {done.length ? (
        <>
          <SectionTitle icon="suzu" count={done.length}>
            已完成
          </SectionTitle>
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
          <SectionTitle
            icon="koyomi"
            count={extraPending.length}
            aside={<span className="text-sm text-ink-3">已完成 {extraDone.length}</span>}
          >
            版本 / 赛季
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
          <SectionTitle
            icon="ofuda"
            count={oncePending.length}
            aside={<span className="text-sm text-ink-3">已完成 {onceDone.length}</span>}
          >
            一次性
          </SectionTitle>
          <div className={CHECKLIST_GRID}>
            {[...oncePending, ...onceDone].map((item) => (
              <ChecklistItem key={item.id} item={item} showDeadline={Boolean(item.deadline)} />
            ))}
          </div>
        </>
      ) : null}

      <p className="px-3.5 pt-4 text-sm leading-relaxed text-ink-3">
        每张卡右侧标注截止日期与剩余天数：≤7 天转金、≤3 天转朱，活动结束后自动移出。
        没标截止的（如联动、待定档）按「截止未定」处理，以游戏内为准。
      </p>

      <KikyoBand className="mx-3.5 mt-4 opacity-90" />
    </div>
  );
}
