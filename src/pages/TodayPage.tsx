import ChecklistEntry from '../components/common/ChecklistEntry';
import ChecklistItem from '../components/common/ChecklistItem';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import { sectionNo } from '../components/common/sectionNo';
import HubCard from '../components/common/HubCard';
import PageHead from '../components/common/PageHead';
import SummaryBar from '../components/common/SummaryBar';
import { Closing, Rule } from '../components/ornament';
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
 * 2026-09-11 曾拆「常驻 / 活动」双 Tab（**2026-09-28 已删除**）：
 *   - **常驻** = 长期每日模板：一键日常入口 + `items.db.json` 的 daily 条目；
 *   - **活动**  = 活动期每日任务：当时是 `limited.db.json` 里带 until 的 daily 条目。
 * 删除原因：活动期每日任务改走 `cycle: 'limited'` + 子步骤（N 次任务）只出现在限时页，
 * 于是"按 `until` / `deadline` 二分"（`isEvent`）不再有对象 —— 今日页只列常驻，回到一个列表。
 *
 * 2026-09-23 换肤：
 *   - 页头：衬线标题 + 自然日期 + **全页唯一的倒计时**（等宽）；
 *   - 符纸签式双 Tab → 分组头（图标 + 计数 + 真实完成比例底轨）；
 *   - 末尾注连绳与桔梗纹带收束。
 *
 * 达摩点睛（今天全部做完时右眼点亮、整只由金转朱红）2026-09-23 起隐藏，
 * **2026-09-28 整体删除**：`ornament.Daruma` 组件与 `theme.css` 的
 * `.genso-daruma` / `.all-done` 效果链一并退场 —— 那条链没有第二个消费者，
 * 留着只是"随时可恢复"，与本项目"死符号要么用上、要么删"的口径冲突。
 */
export default function TodayPage() {
  const { hub, hubDone, pending, done, coveredSet, coverMode } = useChecklist('today');
  const { toggleHub } = useAutoDaily();
  /* 距明天 0 点（下一次重置）还有多久 —— 结束点与勾选重置同源，见 domain/reset.periodEndOf */
  const countdown = usePeriodCountdown('daily');
  /* 分组序号（壹/贰/叁…）：按**实际渲染顺序**发号 —— 见 `sectionNo` 的说明 */
  const no = sectionNo();

  /* 2026-09-28：今日页只列**常驻**。活动期的每日任务一律 `cycle: 'limited'` + `children`
     （N 次任务），走**限时页** —— 那边不按周期翻篇，所以"还要做几次"由次数表示，
     正好补上"勾一次就永久勾着"的缺口（见 `limited.db.json` 的拾光永恒 4 条）。
     于是"周期是 daily 却带 `until`/`deadline`"这一类不再存在，旧「活动」Tab 连同
     `isEvent` 二分一并删除 —— 今日页回到一个列表。 */
  const residentDoneCount = done.length + (hubDone ? 1 : 0);

  const isDimmed = (id: string) => coverMode === 'dim' && coveredSet.has(id);

  return (
    <div className="pb-6">
      {/* 顶部日期：纯展示（自然日历），与勾选重置（0 点）语义无关 —— 见 domain/dateLabel。
          后面的倒计时**刻意不同源**：它走 domain/reset 的周期终点，即"还有多久被重置" */}
      <PageHead
        title="今日"
        detail={todayDateLabel(new Date())}
        countdown={countdown}
        countdownLabel="每日重置"
      />

      {/* 汇总条（册页稿 `.summary`）：页级"待办 / 已成 / 进度"只在这一处说，
          分组头不再重复进度轨。它是"今天"的账 —— 今日页只有常驻，活动期任务走限时页 */}
      <SummaryBar
        className="mx-3.5 mt-3"
        pending={pending.length}
        done={residentDoneCount}
        note="投一档 = 记一笔，零点结账"
      />

      {hub && !hubDone ? <HubCard item={hub} /> : null}

          <SectionTitle no={no()} icon="ema" count={pending.length}>
            今天该做
          </SectionTitle>
          {pending.length ? (
            <div className={CHECKLIST_GRID}>
              {pending.map((it) => (
                <ChecklistEntry key={it.id} item={it} dimmedOf={isDimmed} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="今天的清单已清空"
              hint="新增或恢复条目可在「设置」里调整；刷新时间为每日 0 点。"
            />
          )}

          {residentDoneCount > 0 ? (
            <>
              <SectionTitle no={no()} icon="done" count={residentDoneCount}>
                今天已结
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
                {done.map((it) => (
                  <ChecklistEntry key={it.id} item={it} dimmedOf={isDimmed} />
                ))}
              </div>
            </>
          ) : null}

      {/* 收束：墨线菱点断句 + 四字铭落款（册页稿 `.rule` + `.closing`） */}
      <Rule className="mx-3.5 mt-6" />
      <Closing text="一日一愿" />
    </div>
  );
}
