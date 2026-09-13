import type { GainSummary } from '../../domain/stats';
import ProgressBar from './ProgressBar';

/**
 * 统计页的三色大字块：勾玉（绿）/ 黑碎（紫）/ 蓝票（蓝）。
 * 数字层级明显高于说明文字 —— 高密度信息里先看数字，再看口径。
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
