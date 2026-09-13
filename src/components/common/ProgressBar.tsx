import { tokens } from '../../styles/tokens';

/**
 * 进度条。**只有宽度是计算值**，因此只有宽度用 `style` prop
 * （设计文档 §8.2 明确列为合法动态值场景）；颜色取自 `styles/tokens.ts`，JS 与 CSS 同源。
 *
 * 2026-09-11：原来的 `height` prop 是静态值（唯一调用方 `GainBar` 从不传、永远取默认 3），
 * 按"内联只留给动态值"的纪律换成类。高度收成固定 3px —— 三个 GainBar 本来就必须等高。
 */
export default function ProgressBar({
  pct,
  tone = 'success',
}: {
  pct: number;
  tone?: 'success' | 'jade' | 'frag' | 'ticket';
}) {
  const color = {
    success: tokens.color.success,
    jade: tokens.color.jade,
    frag: tokens.color.frag,
    ticket: tokens.color.ticket,
  }[tone];
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));

  return (
    <div className="h-[3px] overflow-hidden rounded-sm bg-surface-3">
      <i
        className="block h-full rounded-sm transition-all duration-180"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
