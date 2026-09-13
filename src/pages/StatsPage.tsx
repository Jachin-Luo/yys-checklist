import { useMemo, useState } from 'react';
import CheckBox from '../components/common/CheckBox';
import { EmptyState, SectionTitle } from '../components/common/EmptyState';
import GainBar from '../components/common/GainBar';
import { PERIOD_META, missGroups, summarizeGain, type StatPeriod } from '../domain/stats';
import { useCheckStore } from '../stores/check';
import { useItemStore } from '../stores/items';

const PERIODS: StatPeriod[] = ['day', 'week', 'month'];

const gainText = (gain: { jade?: number; blackFrag?: number; blueTicket?: number }): string => {
  const parts: string[] = [];
  if (gain.jade) parts.push(`勾玉 ${gain.jade}`);
  if (gain.blackFrag) parts.push(`黑碎 ${gain.blackFrag}`);
  if (gain.blueTicket) parts.push(`蓝票 ${gain.blueTicket}`);
  return parts.join(' · ');
};

/**
 * 统计页（设计文档 §9 S4b-2 / Q23：维持「最强留存钩子」定位）。
 *
 * 口径由 `domain/stats.ts` 承担，本页只做排列。**这里直接吃原始 `checked`** ——
 * 统计必须忽略「隐藏已完成」，否则已勾条目被过滤会让「已获得」归零（原型为此专门传 keepDone）。
 * 被一键日常覆盖的条目即使被 `hide` 掉也照样计入。
 */
export default function StatsPage() {
  const items = useItemStore((s) => s.items);
  const checked = useCheckStore((s) => s.checked);
  const toggle = useCheckStore((s) => s.toggle);
  const [period, setPeriod] = useState<StatPeriod>('day');

  const report = useMemo(() => summarizeGain(items, checked, period), [items, checked, period]);
  const misses = useMemo(() => missGroups(items, checked, period), [items, checked, period]);
  const meta = PERIOD_META[period];

  return (
    /* 不再 `mx-auto` 居中：桌面端各页一旦各自居中，切页时内容会左右横跳（1024 / 896 / 768 / 672 四套宽度）。
       居中的职责只保留在 DesktopShell 一层，页面只负责"最宽多少"（行长可读性） */
    <div className="max-w-3xl px-3.5 py-3 pb-10">
      <div className="flex w-fit overflow-hidden rounded-sm border border-line">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`cursor-pointer px-3 py-1.5 text-sm transition-colors duration-120 ${
              period === p ? 'bg-brand text-white' : 'bg-surface text-ink-2 hover:bg-surface-3'
            }`}
          >
            {PERIOD_META[p].label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-sm text-ink-3">{meta.note}</p>

      {/* `md` 而不是 `sm`：统计页在移动壳里也用同一份代码，而 `sm`(640px) 在手机上也会命中 ——
          640–767px（横屏手机）会莫名变成三列，与"窄屏一律单列"的全局口径打架 */}
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <GainBar label="勾玉" unit="固定奖励" summary={report.jade} tone="jade" />
        <GainBar label="黑碎" unit="1 黑蛋 = 25 片" summary={report.blackFrag} tone="frag" />
        <GainBar label="蓝票" unit="神秘的符咒" summary={report.blueTicket} tone="ticket" />
      </div>

      <SectionTitle>{meta.label}可量化条目 · {report.rows.length} 条</SectionTitle>
      {report.rows.length ? (
        <div className="overflow-hidden rounded-lg border border-line-soft bg-surface">
          {report.rows.map((row) => {
            const on = checked[row.id] !== undefined;
            return (
              <div
                key={row.id}
                onClick={() => void toggle(row.id)}
                className={`flex cursor-pointer items-center gap-2.5 border-b border-line-faint px-3 py-2 last:border-0 transition-colors duration-120 hover:bg-surface-3 ${
                  on ? 'opacity-45' : ''
                }`}
              >
                <CheckBox
                  size="sm"
                  checked={on}
                  onToggle={() => toggle(row.id)}
                  label={`${on ? '取消完成' : '标记完成'}：${row.name}`}
                />
                <span className={`min-w-0 flex-1 truncate text-lg text-ink ${on ? 'line-through' : ''}`}>
                  {row.name}
                </span>
                <span className="flex-none text-sm text-ink-2">{gainText(row.gain)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="该周期没有可量化条目" hint="只有标注了固定数值的条目会进统计；浮动收益不折算、不估算。" />
      )}

      <SectionTitle>漏失明细 · 按痛感分级</SectionTitle>
      {misses.length ? (
        <div className="space-y-2">
          {misses.map((group) => (
            <div key={group.level} className="overflow-hidden rounded-lg border border-line-soft bg-surface">
              <p className="border-b border-line-faint px-3 py-1.5 text-sm text-ink-3">
                {group.label} · {group.items.length} 项
              </p>
              {group.items.map((it) => (
                <div key={it.id} className="flex items-baseline gap-3 border-b border-line-faint px-3 py-2 last:border-0">
                  {/* 外层卡片是 `overflow-hidden`：不给 `truncate` 的超长名称会被**硬切且没有省略号**
                      （同一页上面那组"可量化条目"却有 truncate，自相矛盾） */}
                  <span className="min-w-0 flex-1 truncate text-lg text-ink">{it.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="这个周期没有漏失" hint="清单里的条目都已完成。" />
      )}

      <p className="mt-4 text-sm leading-relaxed text-ink-3">
        只统计固定数值（勾玉 / 黑碎 / 蓝票），数量浮动的收益自动排除。漏失明细只列事实、不折算、不估算 ——
        玩家对「漏了几个黑蛋」的体感远比「折合多少勾玉」准确。
      </p>
    </div>
  );
}
