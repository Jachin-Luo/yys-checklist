import { useState } from 'react';
import type { Item } from '../api/types';
import ChecklistItem from '../components/common/ChecklistItem';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import HubCard from '../components/common/HubCard';
import PageHead from '../components/common/PageHead';
import ViewBar from '../components/common/ViewBar';
import Icon from '../components/icons/Icon';
import { Daruma, KikyoBand, Shimenawa } from '../components/ornament';
import { todayDateLabel } from '../domain/dateLabel';
import { useAutoDaily } from '../hooks/useAutoDaily';
import { useChecklist } from '../hooks/useChecklist';
import { usePeriodCountdown } from '../hooks/usePeriodCountdown';
import { CHECKLIST_GRID } from '../styles/layout';

/**
 * 「达摩点睛」总开关 —— 2026-09-23 起为 `false`（用户决策：先隐藏）。
 *
 * 关的只是**这一块的渲染**：`allDone` 判定与 `.all-done` 效果链（右眼点亮、整只由金转朱红）
 * 原地保留 —— 那条链同时承载"全清时一屏只留一个视觉重心"的语义，
 * 以后要放到别处复用（如设置页观感分区）也直接可用，删掉再写一遍不划算。
 * 改回 `true` 即恢复。
 *
 * 显式标注 `: boolean` 是**有意为之**：不加的话 TS 会把它收窄成字面量 `false`，
 * 把下面的三元判定成恒取一支。与 `stores/view.SHOW_KIND_FILTER` 同一约定。
 */
const SHOW_ALL_DONE: boolean = false;

/**
 * 今日页（设计文档 §9 S4b-1）。
 *
 * 2026-09-15：顶部那条「本周高痛感还有 N 项没做」警示条**已删除**（它自 2026-09-10 起
 * 就被 `SHOW_WEEKLY_ALERT` 关着）。随「痛感只用于默认排序」的收敛，`useChecklist`
 * 也不再计算 `weeklyHighWeightLeft` —— 痛感现在只影响排序，不再驱动任何提示或筛选。
 *
 * 2026-09-11 拆「常驻 / 活动」双 Tab（用户决策）：
 *   - **常驻** = 长期每日模板：一键日常入口 + `items.db.json` 的 daily 条目；
 *   - **活动**  = 活动期每日任务：`limited.db.json` 来源（如拾光永恒每日，带 until、到期即删）。
 * 分组判据与文件拆分口径一致：**带 `until` / `deadline` 即活动期**。
 *
 * 2026-09-23 换肤：
 *   - 页头：衬线标题 + 自然日期 + **全页唯一的倒计时**（等宽）；
 *   - 符纸签式双 Tab → 分组头（图标 + 计数 + 真实完成比例底轨）；
 *   - 末尾注连绳与桔梗纹带收束。
 *
 * 达摩点睛（今天全部做完时右眼点亮、整只由金转朱红）2026-09-23 起按用户决策隐藏，
 * 见文件顶部的 `SHOW_ALL_DONE`。
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

  const residentTotal = pendingResident.length + residentDoneCount;
  const eventTotal = pendingEvent.length + doneEvent.length;
  const allTotal = residentTotal + eventTotal;
  /* 达摩点睛判定：今天有内容、且一条都没剩（与统计三卡同一次渲染，不新增状态源） */
  const allDone = allTotal > 0 && pendingResident.length === 0 && pendingEvent.length === 0;

  /* 符纸签式 Tab：上圆下方 + 底轨横线；选中签顶部一道 22×2 朱红短线（额束） */
  const tabChip = (on: boolean) =>
    `relative flex cursor-pointer items-center gap-1.5 rounded-t-sm border border-b-0 px-3 py-2 font-serif text-sm tracking-label transition-colors duration-120 ${
      on
        ? 'border-line bg-surface text-gold-hi'
        : 'border-transparent text-ink-3 hover:bg-gold-soft hover:text-gold'
    }`;

  return (
    <div className={`pb-6 ${allDone ? 'all-done' : ''}`}>
      {/* 筛选 2026-09-23 起整体下线（`stores/view.SHOW_KIND_FILTER`）：此处 ViewBar 渲染空。
          调用保留，是为了恢复时不必回来改页面 */}
      {variant === 'desktop' ? <ViewBar mode="desktop" /> : null}

      {/* 顶部日期：纯展示（自然日历），与勾选重置（0 点）语义无关 —— 见 domain/dateLabel。
          后面的倒计时**刻意不同源**：它走 domain/reset 的周期终点，即"还有多久被重置" */}
      <PageHead
        title="今日"
        detail={todayDateLabel(new Date())}
        countdown={countdown}
        countdownLabel="每日重置"
        action={variant === 'mobile' ? <ViewBar mode="mobile" /> : null}
        /* 达摩点睛 2026-09-23 暂时下线（见上方 `SHOW_ALL_DONE`）。
           开启时它是常驻但极轻的一笔（17px 金 70%）：静态层只放状态，仪式感押给"全清那一瞬" */
        aside={
          SHOW_ALL_DONE ? (
            <div className="mt-2">
              <Daruma />
            </div>
          ) : undefined
        }
      />

      <div className="mx-3.5 mt-4 flex items-end gap-1.5 border-b border-line-soft">
        <button type="button" className={tabChip(tab === 'resident')} onClick={() => setTab('resident')}>
          {tab === 'resident' ? (
            <i className="absolute left-1/2 top-0 h-0.5 w-5 -translate-x-1/2 bg-crimson" />
          ) : null}
          <Icon name="torii" size={15} className={tab === 'resident' ? '' : 'opacity-70'} />
          常驻 · {pendingResident.length} 项
        </button>
        <button type="button" className={tabChip(tab === 'event')} onClick={() => setTab('event')}>
          {tab === 'event' ? (
            <i className="absolute left-1/2 top-0 h-0.5 w-5 -translate-x-1/2 bg-crimson" />
          ) : null}
          <Icon name="chochin" size={15} className={tab === 'event' ? '' : 'opacity-70'} />
          活动 · {pendingEvent.length} 项
        </button>
      </div>

      {tab === 'resident' ? (
        <>
          {hub && !hubDone ? <HubCard item={hub} /> : null}

          <SectionTitle
            icon="torii"
            count={pendingResident.length}
            progress={residentTotal ? residentDoneCount / residentTotal : undefined}
          >
            今天该做
          </SectionTitle>
          {pendingResident.length ? (
            <div className={CHECKLIST_GRID}>
              {pendingResident.map((item) => (
                <ChecklistItem key={item.id} item={item} dimmed={isDimmed(item.id)} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="今天的常驻清单已清空"
              hint="新增或恢复条目可在「设置」里调整；刷新时间为每日 0 点。"
            />
          )}

          {residentDoneCount > 0 ? (
            <>
              <SectionTitle icon="suzu" count={residentDoneCount}>
                已完成
              </SectionTitle>
              <div className={CHECKLIST_GRID}>
                {hub && hubDone ? (
                  <ChecklistItem
                    item={hub}
                    onToggle={toggleHub}
                    /* 长按跨账号时一并写入被覆盖项 —— 与 `toggleHub` 的级联范围一致，
                       否则目标账号会出现"入口已完成、覆盖项没勾"的不一致 */
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
          <SectionTitle
            icon="chochin"
            count={pendingEvent.length}
            progress={eventTotal ? doneEvent.length / eventTotal : undefined}
          >
            活动任务
          </SectionTitle>
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
              <SectionTitle icon="suzu" count={doneEvent.length}>
                已完成
              </SectionTitle>
              <div className={CHECKLIST_GRID}>
                {doneEvent.map((item) => (
                  <ChecklistItem key={item.id} item={item} dimmed={isDimmed(item.id)} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      {/* 收束横幅：末组下方一道注连绳，把整页"扎"住 */}
      <Shimenawa className="mx-3.5 mt-6" />
      <KikyoBand className="mx-3.5 opacity-90" />
    </div>
  );
}
