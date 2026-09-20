import { useState } from 'react';
import type { Item } from '../api/types';
import ChecklistItem from '../components/common/ChecklistItem';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import HubCard from '../components/common/HubCard';
import ViewBar from '../components/common/ViewBar';
import { todayDateLabel } from '../domain/dateLabel';
import { useAutoDaily } from '../hooks/useAutoDaily';
import { useChecklist } from '../hooks/useChecklist';
import { usePeriodCountdown } from '../hooks/usePeriodCountdown';
import { CHECKLIST_GRID } from '../styles/layout';

/**
 * 今日页（设计文档 §9 S4b-1）。
 *
 * 2026-09-15：顶部那条「本周高痛感还有 N 项没做」警示条**已删除**（它自 2026-09-10 起
 * 就被 `SHOW_WEEKLY_ALERT` 关着）。随「痛感只用于默认排序」的收敛，`useChecklist`
 * 也不再计算 `weeklyHighWeightLeft` —— 痛感现在只影响排序，不再驱动任何提示或筛选。
 *
 * 2026-09-11 拆「常驻 / 活动」双 Tab（用户决策；曾考虑用边框色标识、最终仍选 Tab 分层）：
 *   - **常驻** = 长期每日模板：一键日常入口 + `items.db.json` 的 daily 条目；
 *   - **活动**  = 活动期每日任务：`limited.db.json` 来源（如拾光永恒每日，带 until、到期即删）。
 *
 * 分组判据与文件拆分口径一致：**带 `until` / `deadline` 即活动期** —— 不给 Item 加来源字段，
 * 数据、勾选、重置、级联逻辑零改动，这里只做视图分层。
 * 入口卡属于常驻模板，归常驻 Tab；已完成分区里取消勾选同样走双向级联。
 */
export default function TodayPage({ variant }: { variant: 'mobile' | 'desktop' }) {
  const { hub, hubDone, pending, done, coveredSet, coverMode } = useChecklist('today');
  const { toggleHub } = useAutoDaily();
  /* 距明天 0 点（下一次重置）还有多久 —— 结束点与勾选重置同源，见 domain/reset.periodEndOf */
  const countdown = usePeriodCountdown('daily');
  const [tab, setTab] = useState<'resident' | 'event'>('resident');

  const isEvent = (it: Item) => Boolean(it.until || it.deadline);

  const pendingResident = pending.filter((it) => !isEvent(it));
  const pendingEvent = pending.filter(isEvent);
  const doneResident = done.filter((it) => !isEvent(it));
  const doneEvent = done.filter(isEvent);
  /* 入口（一键日常）是常驻模板：它的完成态只计入常驻组 */
  const residentDoneCount = doneResident.length + (hubDone ? 1 : 0);

  const isDimmed = (id: string) => coverMode === 'dim' && coveredSet.has(id);

  /* Tab 样式与 ViewBar 的筛选 chip 同一语言 */
  const tabChip = (on: boolean) =>
    `cursor-pointer rounded-sm border px-2.5 py-1 text-sm transition-colors duration-120 ${
      on
        ? 'border-brand bg-brand-soft font-medium text-brand'
        : 'border-line bg-surface text-ink-2 hover:border-ink-4'
    }`;

  return (
    <div className="pb-6">
      <ViewBar mode={variant} />

      {/* 顶部日期：纯展示（自然日历），与勾选重置（0 点）语义无关 —— 见 domain/dateLabel。
          后面的倒计时**刻意不同源**：它走 domain/reset 的周期终点，即"还有多久被重置" */}
      <p className="px-3.5 pt-2.5 text-sm text-ink-3">
        今天 <b className="font-medium text-ink">{todayDateLabel(new Date())}</b>
        {countdown ? (
          <>
            {' · '}
            <b className="font-medium text-ink-2">{countdown}</b>
          </>
        ) : null}
      </p>

      <div className="flex items-center gap-1.5 px-3.5 pt-2.5">
        <button type="button" className={tabChip(tab === 'resident')} onClick={() => setTab('resident')}>
          常驻 · {pendingResident.length} 项
        </button>
        <button type="button" className={tabChip(tab === 'event')} onClick={() => setTab('event')}>
          活动 · {pendingEvent.length} 项
        </button>
      </div>

      {tab === 'resident' ? (
        <>
          {hub && !hubDone ? <HubCard item={hub} /> : null}

          <SectionTitle>今天该做 · {pendingResident.length} 项</SectionTitle>
          {pendingResident.length ? (
            <div className={CHECKLIST_GRID}>
              {pendingResident.map((item) => (
                <ChecklistItem key={item.id} item={item} dimmed={isDimmed(item.id)} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="今天的常驻清单已清空"
              hint="新增或恢复条目可在「我的」里调整；刷新时间为每日 0 点。"
            />
          )}

          {residentDoneCount > 0 ? (
            <>
              <SectionTitle>已完成 · {residentDoneCount} 项</SectionTitle>
              <div className={CHECKLIST_GRID}>
                {hub && hubDone ? (
                  <ChecklistItem
                    item={hub}
                    onToggle={toggleHub}
                    /* 长按跨档案时一并写入被覆盖项 —— 与 `toggleHub` 的级联范围一致，
                       否则目标档案会出现"入口已完成、覆盖项没勾"的不一致 */
                    cascadeIds={[...coveredSet]}
                  />
                ) : null}
                {doneResident.map((item) => (
                  <ChecklistItem key={item.id} item={item} dimmed={isDimmed(item.id)} />
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          <SectionTitle>活动任务 · {pendingEvent.length} 项</SectionTitle>
          {pendingEvent.length ? (
            <div className={CHECKLIST_GRID}>
              {pendingEvent.map((item) => (
                <ChecklistItem key={item.id} item={item} dimmed={isDimmed(item.id)} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="当前没有活动期每日任务"
              hint="版本活动的每日部分会出现在这里；活动结束后条目自动下线。"
            />
          )}

          {doneEvent.length > 0 ? (
            <>
              <SectionTitle>已完成 · {doneEvent.length} 项</SectionTitle>
              <div className={CHECKLIST_GRID}>
                {doneEvent.map((item) => (
                  <ChecklistItem key={item.id} item={item} dimmed={isDimmed(item.id)} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
