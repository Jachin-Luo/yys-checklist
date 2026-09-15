import type { GainSummary } from '../../domain/stats';
import ProgressBar from './ProgressBar';

/**
 * 三色大字块：勾玉（绿）/ 黑碎（紫）/ 蓝票（蓝）。
 * 数字层级明显高于说明文字 —— 高密度信息里先看数字，再看口径。
 *
 * **2026-09-15 起暂无消费方**：统计页改版为「月度日历 + 时间区间收益」后不再展示
 * 「本周期进度」，改由页面内的累计数字卡承担（按日期区间求和，没有总量 / 百分比的概念）。
 * 保留它的理由与 `domain/stats.summarizeGain` 一致：周期进度口径仍有单测保护，
 * 想恢复"本日 / 本周 / 本月进度条"时只改页面即可。
 */
export default function GainBar({
  label,
  unit,
  summary,
  tone,
}: {
  label: string;
  unit: string;
  summary: GainSummary;
  tone: 'jade' | 'frag' | 'ticket';
}) {
  const toneText = { jade: 'text-jade', frag: 'text-frag', ticket: 'text-ticket' }[tone];

  return (
    <div className="rounded-md border border-line-soft bg-surface px-3 py-3">
      <p className="text-sm text-ink-3">{label}</p>
      <p className={`mt-1 text-xl font-medium ${toneText}`}>
        {summary.got}
        <em className="ml-1 text-base not-italic text-ink-3">/ {summary.total}</em>
      </p>
      <p className="mt-0.5 text-sm text-ink-3">
        {unit} · 还差 {summary.left}
      </p>
      <div className="mt-2">
        <ProgressBar pct={summary.pct} tone={tone} />
      </div>
    </div>
  );
}
