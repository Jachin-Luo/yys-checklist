import { useMemo } from 'react';
import Alert from '../components/common/Alert';
import ChecklistEntry from '../components/common/ChecklistEntry';
import { groupChecklist } from '../domain/grouping';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import { sectionNo } from '../components/common/sectionNo';
import PageHead from '../components/common/PageHead';
import SummaryBar from '../components/common/SummaryBar';
import ViewBar from '../components/common/ViewBar';
import { Closing, Rule } from '../components/ornament';
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
 * 2026-09-28 起本页只有两个分区（进行中 / 已结）：`version` / `season` 两个周期已并入
 * `limited`（见 `domain/enums` 的收口说明），原先那个「版本 / 赛季」分区连同它的锚点提示
 * 一起退场 —— 版本活动与限时活动在同一张列表里按剩余天数排，
 * **没有截止日期的（版本活动、联动、待定档）一律沉底**，与「截止未定」同待遇。
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

  const { pending, done, urgentIds } = useMemo(() => {
    const now = new Date();
    const visibility = {
      /* 同 `hooks/useChecklist`：筛选总开关关着时传空数组（见 `stores/view.SHOW_KIND_FILTER`） */
      showKinds: SHOW_KIND_FILTER ? (view.showKinds as string[]) : [],
      today: now.getDay(),
    };
    const list = items
      .filter((it) => it.cycle === 'limited')
      .filter((it) => isVisible(it, visibility))
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
      urgentIds: new Set(undone.filter(isUrgent).map((it) => it.id)),
    };
  }, [items, checked, view, overrides]);

  const urgent = urgentIds.size;
  /* 分组序号（壹/贰…）：按渲染顺序发号 —— 本页两个分区都可能整块不渲染（无进行中的、无已结），
     写死序号必然跳号，见 `sectionNo` 的说明 */
  const no = sectionNo();

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

      {/* 汇总条（册页稿 `.summary`）：限时页也有自己的账 —— 在跑的与已结的 */}
      <SummaryBar className="mx-3.5 mt-3" pending={pending.length} done={done.length} note="到期即归档" />

      <SectionTitle no={no()} icon="chochin" count={pending.length}>
        限时活动 · 进行中
      </SectionTitle>
      {pending.length ? (
        <div className={CHECKLIST_GRID}>
          {groupChecklist(pending, done).pending.map((u) => (
            <ChecklistEntry
              key={u.key}
              unit={u}
              showDeadline
              highlightOf={(id) => urgentIds.has(id)}
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
          <SectionTitle no={no()} icon="done" count={done.length}>
            限时已结
          </SectionTitle>
          <div className={CHECKLIST_GRID}>
            {groupChecklist(pending, done).done.map((u) => (
              <ChecklistEntry key={u.key} unit={u} showDeadline />
            ))}
          </div>
        </>
      ) : null}

      <p className="px-3.5 pt-4 text-sm leading-relaxed text-ink-3">
        每张卡右侧标注截止日期与剩余天数：≤7 天转金、≤3 天转朱，活动结束后自动移出。
        没标截止的（如联动、待定档）按「截止未定」处理，以游戏内为准。
      </p>

      {/* 收束：墨线菱点断句 + 四字铭落款 */}
      <Rule className="mx-3.5 mt-6" />
      <Closing text="到期即归档" />
    </div>
  );
}
