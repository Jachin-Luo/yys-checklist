import { tokens } from '../../styles/tokens';

/**
 * 进度条。**只有宽度是计算值**，因此只有宽度用 `style` prop
 * （设计文档 §8.2 明确列为合法动态值场景）；颜色取自 `styles/tokens.ts`，JS 与 CSS 同源。
 *
 * 2026-09-11：原来的 `height` prop 是静态值（唯一调用方 `GainBar` 从不传、永远取默认 3），
 * 按"内联只留给动态值"的纪律换成类。高度收成固定 3px —— 三个 GainBar 本来就必须等高。
 *
 * 2026-09-15：`GainBar`（唯一调用方）随统计页改版失去消费方，本组件目前也没有别的引用 ——
 * 一并保留，理由同 `GainBar` 的文件头说明。
 *
 * 2026-09-23：原末句提到的"移动端头部那条 3px 进度条"已随顶栏简化移除（用户要求：进度在页面里
 * 各自都有），`MobileShell` 不再内联进度轨。因此**本组件是全库唯一的进度条实现且当前零消费方** ——
 * 要恢复任何进度条，从它开始，不必再新写一个。
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
