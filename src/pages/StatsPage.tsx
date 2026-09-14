import { useMemo, useState } from 'react';
import GainBar from '../components/common/GainBar';
import { PERIOD_META, summarizeGain, type StatPeriod } from '../domain/stats';
import { useCheckStore } from '../stores/check';
import { useItemStore } from '../stores/items';

const PERIODS: StatPeriod[] = ['day', 'week', 'month'];

/**
 * 统计页（设计文档 §9 S4b-2 / Q23：维持「最强留存钩子」定位）。
 *
 * 口径由 `domain/stats.ts` 承担，本页只做排列。**这里直接吃原始 `checked`** ——
 * 统计必须忽略「隐藏已完成」，否则已勾条目被过滤会让「已获得」归零（原型为此专门传 keepDone）。
 * 被一键日常覆盖的条目即使被 `hide` 掉也照样计入。
 *
 * 2026-09-14 按用户要求**移除「可量化条目」与「漏失明细」两个分区**：
 * 前者与清单页重复（同一个条目在今日页也能勾，不必在这里再列一遍），
 * 后者只是复述"漏了哪些条目"，占了大半屏却不提供新信息。
 * 页面现在只保留三条收益进度条与口径说明。
 * `domain/stats.ts` 的 `missGroups` 仍然保留（有单测保护、随时可恢复），只是暂时没有页面消费它。
 */
export default function StatsPage() {
  const items = useItemStore((s) => s.items);
  const checked = useCheckStore((s) => s.checked);
  const [period, setPeriod] = useState<StatPeriod>('day');

  const report = useMemo(() => summarizeGain(items, checked, period), [items, checked, period]);
  const meta = PERIOD_META[period];

  return (
    /* `mx-auto` 居中：本页宽度上限 768，而桌面内容容器上限 1024 —— 不居中时右侧会空出约 256px，
       看起来像"内容没写完"（2026-09-14 用户反馈）。
       代价是切页时左右边界会随各页宽度变化（今日系 1024 / 工具 896 / 本页 768 / 我的 672），
       两害相权取居中；内容区上限与整体框架仍由 DesktopShell 负责 */
    <div className="mx-auto max-w-3xl px-3.5 py-3 pb-10">
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

      <p className="mt-4 text-sm leading-relaxed text-ink-3">
        只统计固定数值（勾玉 / 黑碎 / 蓝票）：数量浮动的收益不折算、不估算 ——
        把「看运气掉几个」当保底算，比不算更误导。
      </p>
    </div>
  );
}
